param(
    [ValidateSet("Smoke", "All")]
    [string]$Suite = "Smoke",
    [string]$CaseId,
    [switch]$Run,
    [switch]$AllowDirty,
    [switch]$KeepWorktrees,
    [string]$Model = "gpt-6-luna",
    [ValidateSet("low", "medium", "high")]
    [string]$ReasoningEffort = "medium",
    [int]$MaxCases = 0,
    [string]$OutputRoot = (Join-Path $env:TEMP "carez-codex-execution-evals")
)

$ErrorActionPreference = "Stop"

function Read-JsonLines {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path $Path)) { throw "Missing JSONL file: $Path" }
    $items = @()
    foreach ($line in Get-Content -Path $Path) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $items += ($line | ConvertFrom-Json)
    }
    return @($items)
}
function Normalize-PathText {
    param([string]$Path)
    if ($null -eq $Path) { return "" }
    return ($Path -replace "\\", "/").Trim()
}

function Get-TextHash {
    param([string]$Text)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$Text)
        return (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join "")
    }
    finally {
        $sha.Dispose()
    }
}

function Get-FixtureFingerprint {
    param([string]$Worktree)
    $fixtureRoot = Join-Path $Worktree ".carez-eval-fixture"
    if (-not (Test-Path $fixtureRoot)) { return Get-TextHash "" }
    $rows = @()
    foreach ($file in Get-ChildItem -Path $fixtureRoot -Recurse -File | Sort-Object FullName) {
        $relative = Normalize-PathText ($file.FullName.Substring($Worktree.Length).TrimStart("\", "/"))
        $hash = (Get-FileHash -Algorithm SHA256 -Path $file.FullName).Hash.ToLowerInvariant()
        $rows += "$relative|$hash"
    }
    return Get-TextHash ($rows -join [Environment]::NewLine)
}
function Get-GitStatusLines {
    param([string]$Worktree)
    return @(git -C $Worktree status --porcelain=v1 --untracked-files=all)
}

function Get-ChangedPaths {
    param($StatusLines)
    $paths = @()
    foreach ($line in @($StatusLines)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.Length -lt 4) { continue }
        $path = $line.Substring(3).Trim('"')
        if ($path -like "* -> *") { $path = ($path -split " -> ")[-1].Trim('"') }
        $paths += (Normalize-PathText $path)
    }
    return @($paths | Sort-Object -Unique)
}

function Test-PathAllowed {
    param([string]$Path, $Globs)
    foreach ($glob in @($Globs)) {
        if ($Path -like [string]$glob) { return $true }
    }
    return $false
}

function Test-AllPathsAllowed {
    param($Paths, $Globs)
    if ($null -eq $Paths) { return $true }
    foreach ($path in @($Paths)) {
        if ($null -eq $path) { continue }
        if (-not (Test-PathAllowed $path $Globs)) { return $false }
    }
    return $true
}
function Test-RequiredContent {
    param([string]$Worktree, $Checks)
    if ($null -eq $Checks) { return $true }
    foreach ($check in @($Checks)) {
        if ($null -eq $check) { continue }
        $path = Join-Path $Worktree ([string]$check.path -replace "/", "\")
        if (-not (Test-Path $path)) { return $false }
        $text = Get-Content -Raw -Path $path
        if (-not $text.Contains([string]$check.text)) { return $false }
    }
    return $true
}

function Test-ForbiddenContent {
    param([string]$Worktree, $Checks)
    if ($null -eq $Checks) { return $true }
    foreach ($check in @($Checks)) {
        if ($null -eq $check) { continue }
        $path = Join-Path $Worktree ([string]$check.path -replace "/", "\")
        if (-not (Test-Path $path)) { continue }
        $text = Get-Content -Raw -Path $path
        if ($text.Contains([string]$check.text)) { return $false }
    }
    return $true
}

function Get-GlobFiles {
    param([string]$Worktree, [string]$Glob)
    $normalizedGlob = Normalize-PathText $Glob
    $fixtureRoot = Join-Path $Worktree ".carez-eval-fixture"
    if (-not (Test-Path $fixtureRoot)) { return @() }
    return @(
        Get-ChildItem -Path $fixtureRoot -Recurse -File |
            Where-Object {
                $relative = Normalize-PathText ($_.FullName.Substring($Worktree.Length).TrimStart("\", "/"))
                $relative -like $normalizedGlob
            }
    )
}
function Test-RequiredGlobContent {
    param([string]$Worktree, $Checks)
    if ($null -eq $Checks) { return $true }
    foreach ($check in @($Checks)) {
        if ($null -eq $check) { continue }
        $files = @(Get-GlobFiles $Worktree ([string]$check.glob))
        if ($files.Count -eq 0) { return $false }
        foreach ($requiredText in @($check.texts)) {
            $matched = $false
            foreach ($file in $files) {
                $text = (Get-Content -Raw -Path $file.FullName).ToLowerInvariant()
                if ($text.Contains(([string]$requiredText).ToLowerInvariant())) {
                    $matched = $true
                    break
                }
            }
            if (-not $matched) { return $false }
        }
    }
    return $true
}

function Test-RequiredGlobCount {
    param([string]$Worktree, $Spec)
    if ($null -eq $Spec) { return $true }
    $files = @(Get-GlobFiles $Worktree ([string]$Spec.glob))
    return ($files.Count -eq [int]$Spec.count)
}
function Get-CommandRecords {
    param([string]$EventsFile)
    $byId = @{}
    if (-not (Test-Path $EventsFile)) { return @() }
    foreach ($line in Get-Content -Path $EventsFile) {
        try { $event = ([string]$line) | ConvertFrom-Json }
        catch { continue }
        if (-not $event.item -or [string]$event.item.type -ne "command_execution") { continue }
        $id = [string]$event.item.id
        if ([string]::IsNullOrWhiteSpace($id)) { $id = [guid]::NewGuid().ToString() }
        $byId[$id] = [pscustomobject]@{
            id = $id
            command = [string]$event.item.command
            status = [string]$event.item.status
            exit_code = $event.item.exit_code
        }
    }
    return @($byId.Values)
}

function Test-CommandContainsAll {
    param($Commands, $Needles)
    foreach ($needle in @($Needles)) {
        $found = $false
        foreach ($record in @($Commands)) {
            if ($record.command.IndexOf([string]$needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $found = $true
                break
            }
        }
        if (-not $found) { return $false }
    }
    return $true
}
function Test-CommandContainsNone {
    param($Commands, $Needles)
    foreach ($needle in @($Needles)) {
        foreach ($record in @($Commands)) {
            if ($record.command.IndexOf([string]$needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                return $false
            }
        }
    }
    return $true
}

function Get-CommandMatchCount {
    param($Commands, [string]$Needle)
    $count = 0
    foreach ($record in @($Commands)) {
        if ($record.command.IndexOf($Needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            $count += 1
        }
    }
    return $count
}

function Get-UsageTotals {
    param($EventLines)
    $usage = [ordered]@{
        input_tokens = [int64]0
        cached_input_tokens = [int64]0
        output_tokens = [int64]0
        reasoning_output_tokens = [int64]0
    }
    foreach ($line in @($EventLines)) {
        try { $event = ([string]$line) | ConvertFrom-Json }
        catch { continue }
        if ([string]$event.type -ne "turn.completed" -or -not $event.usage) { continue }
        $usage.input_tokens += [int64]$event.usage.input_tokens
        $usage.cached_input_tokens += [int64]$event.usage.cached_input_tokens
        $usage.output_tokens += [int64]$event.usage.output_tokens
        $usage.reasoning_output_tokens += [int64]$event.usage.reasoning_output_tokens
    }
    return [pscustomobject]$usage
}
$Repo = (git rev-parse --show-toplevel).Trim()
if (-not $Repo) { throw "Not inside a Git repository." }

$repoFull = [System.IO.Path]::GetFullPath($Repo).TrimEnd("\", "/")
$outputFull = [System.IO.Path]::GetFullPath($OutputRoot).TrimEnd("\", "/")
if ($outputFull.StartsWith($repoFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "OutputRoot must be outside the source repository so disposable worktrees cannot nest inside it."
}

$DataPath = Join-Path $Repo ".agents\evals\execution-quality.jsonl"
$SmokePath = Join-Path $Repo ".agents\evals\execution-smoke-cases.jsonl"
$SchemaPath = Join-Path $Repo ".agents\evals\schemas\execution-result.schema.json"
$FixtureRoot = Join-Path $Repo ".agents\evals\fixtures"

$Cases = @(Read-JsonLines $DataPath)
$SmokeRefs = @(Read-JsonLines $SmokePath)
if ($Cases.Count -ne 5) { throw "Execution dataset must contain exactly 5 cases; found $($Cases.Count)." }
if ($SmokeRefs.Count -ne 4) { throw "Execution smoke subset must contain exactly 4 cases; found $($SmokeRefs.Count)." }

$CaseIds = @($Cases | ForEach-Object { [string]$_.id })
if (($CaseIds | Sort-Object -Unique).Count -ne $Cases.Count) { throw "Execution dataset contains duplicate IDs." }
$SmokeIds = @($SmokeRefs | ForEach-Object { [string]$_.id })
foreach ($id in $SmokeIds) {
    if ($CaseIds -notcontains $id) { throw "Unknown execution smoke case: $id" }
}
$null = Get-Content -Raw $SchemaPath | ConvertFrom-Json
foreach ($case in $Cases) {
    $fixture = Join-Path $FixtureRoot ([string]$case.fixture)
    if (-not (Test-Path $fixture)) { throw "Missing fixture '$($case.fixture)' for case '$($case.id)'." }
}

if ($CaseId) {
    $Selected = @($Cases | Where-Object { $_.id -eq $CaseId })
    if ($Selected.Count -ne 1) { throw "Unknown execution case ID: $CaseId" }
}
elseif ($Suite -eq "Smoke") {
    $byId = @{}
    foreach ($case in $Cases) { $byId[[string]$case.id] = $case }
    $Selected = @($SmokeIds | ForEach-Object { $byId[$_] })
}
else {
    $Selected = @($Cases)
}
if ($MaxCases -gt 0) { $Selected = @($Selected | Select-Object -First $MaxCases) }

Write-Host "CAREZ PHASE 6C DISPOSABLE-WORKTREE EXECUTION EVAL"
Write-Host "Repository: $Repo"
Write-Host "Cases: $($Cases.Count)"
Write-Host "Smoke cases: $($SmokeIds.Count)"
Write-Host "Selected: $($Selected.Count)"
Write-Host "Model: $Model"
Write-Host "Reasoning: $ReasoningEffort"
Write-Host "Live run: $Run"
if (-not $Run) {
    Write-Host ""
    Write-Host "DRY RUN: no worktrees or Codex model calls will be created."
    $Selected | Select-Object id, category, fixture | Format-Table -AutoSize
    Write-Host "Add -Run to execute fixture tasks inside disposable detached worktrees."
    exit 0
}

$SourceInitialStatusLines = @(git status --porcelain=v1)
$SourceInitialStatus = ($SourceInitialStatusLines -join [Environment]::NewLine)
if ($SourceInitialStatusLines.Count -gt 0 -and -not $AllowDirty) {
    throw "Refusing live execution eval on a dirty source checkout. Commit/clean the baseline or pass -AllowDirty."
}

$Codex = (Get-Command codex -ErrorAction Stop).Source
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RunDir = Join-Path $OutputRoot $Stamp
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
$Results = @()
$GlobalForbiddenCommands = @(
    "git push",
    "git clean",
    "git reset --hard",
    "gh pr",
    "supabase db push",
    "supabase migration up",
    "supabase link",
    "vercel deploy",
    "Invoke-WebRequest",
    "curl "
)
foreach ($case in $Selected) {
    $id = [string]$case.id
    $safeId = $id -replace '[^A-Za-z0-9_.-]', '_'
    $caseDir = Join-Path $RunDir $safeId
    $worktree = Join-Path $caseDir "worktree"
    $eventsFile = Join-Path $caseDir ($safeId + ".events.jsonl")
    $resultFile = Join-Path $caseDir ($safeId + ".result.json")
    $commandsFile = Join-Path $caseDir ($safeId + ".commands.json")
    $fixtureSource = Join-Path $FixtureRoot ([string]$case.fixture)

    New-Item -ItemType Directory -Force -Path $caseDir | Out-Null
    $worktreeAdded = $false
    $parseError = $null
    $exitCode = -1
    $actual = $null
    $record = $null

    Write-Host ""
    Write-Host "SETUP $id"

    try {
        $saved = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $worktreeOutput = @(git -C $Repo worktree add --detach $worktree HEAD 2>&1)
        $worktreeExit = $LASTEXITCODE
        $ErrorActionPreference = $saved
        $worktreeOutput | Set-Content -Path (Join-Path $caseDir "worktree-add.txt") -Encoding UTF8
        if ($worktreeExit -ne 0) { throw "git worktree add failed for $id." }
        $worktreeAdded = $true
        $fixtureTarget = Join-Path $worktree ".carez-eval-fixture"
        Copy-Item -Path $fixtureSource -Destination $fixtureTarget -Recurse -Force

        git -C $worktree add .carez-eval-fixture
        $saved = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $commitOutput = @(git -C $worktree -c user.name="Carez Eval" -c user.email="eval@carez.invalid" commit --no-verify --quiet -m "test: seed $id" 2>&1)
        $commitExit = $LASTEXITCODE
        $ErrorActionPreference = $saved
        $commitOutput | Set-Content -Path (Join-Path $caseDir "fixture-commit.txt") -Encoding UTF8
        if ($commitExit -ne 0) { throw "Fixture baseline commit failed for $id." }

        $baselineHead = (git -C $worktree rev-parse HEAD).Trim()

        if ($case.PSObject.Properties.Name -contains "pre_dirty") {
            $dirtyPath = Join-Path $worktree (([string]$case.pre_dirty.path) -replace "/", "\")
            [System.IO.File]::AppendAllText($dirtyPath, [string]$case.pre_dirty.append)
        }

        $preHead = (git -C $worktree rev-parse HEAD).Trim()
        $preStatusLines = @(Get-GitStatusLines $worktree)
        $preStatus = ($preStatusLines -join [Environment]::NewLine)
        $preFingerprint = Get-FixtureFingerprint $worktree
        Set-Content -Path (Join-Path $caseDir "pre-status.txt") -Value $preStatusLines -Encoding UTF8
        $prePatch = @(git -C $worktree diff --binary HEAD --)
        Set-Content -Path (Join-Path $caseDir "pre-diff.patch") -Value $prePatch -Encoding UTF8

        $prompt = @"
CAREZ PHASE 6C DISPOSABLE-WORKTREE EXECUTION EVAL

You are operating inside an isolated disposable Git worktree created only for this evaluation.
Perform the fixture task exactly as requested. Keep all edits inside .carez-eval-fixture.
Do not commit, push, deploy, mutate remote services, use web search, or clean/reset pre-existing worktree changes.
Do not broaden into unrelated repository files. Use the smallest inspection and validation needed.
When the task is complete, return only the structured result required by the output schema.
For changed_files, list only files you intentionally changed during this run; exclude pre-existing dirty files.
case_id must be exactly "$id".

FIXTURE TASK:
$($case.prompt)
"@

        $reasoningConfig = 'model_reasoning_effort="' + $ReasoningEffort + '"'
        $webConfig = 'web_search="disabled"'
        $codexArgs = @(
            "-C", $worktree,
            "-s", "workspace-write",
            "-a", "never",
            "-m", $Model,
            "-c", $reasoningConfig,
            "-c", $webConfig,
            "exec", "--ephemeral",
            "--output-schema", $SchemaPath,
            "--json",
            "-o", $resultFile,
            "-"
        )
        Write-Host "RUN $id"
        $saved = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $eventLines = @($prompt | & $Codex @codexArgs 2>&1)
        $exitCode = $LASTEXITCODE
        $ErrorActionPreference = $saved
        Set-Content -Path $eventsFile -Value $eventLines -Encoding UTF8
        $usage = Get-UsageTotals $eventLines

        if ($exitCode -eq 0 -and (Test-Path $resultFile)) {
            try { $actual = Get-Content -Raw $resultFile | ConvertFrom-Json }
            catch { $parseError = $_.Exception.Message }
        }

        $postHead = (git -C $worktree rev-parse HEAD).Trim()
        $postStatusLines = @(Get-GitStatusLines $worktree)
        $postStatus = ($postStatusLines -join [Environment]::NewLine)
        $postFingerprint = Get-FixtureFingerprint $worktree
        $changedPaths = @(Get-ChangedPaths $postStatusLines)

        Set-Content -Path (Join-Path $caseDir "post-status.txt") -Value $postStatusLines -Encoding UTF8

        $saved = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $null = @(git -C $worktree add -N .carez-eval-fixture 2>&1)
        $postPatch = @(git -C $worktree diff --binary HEAD --)
        $null = @(git -C $worktree reset --quiet HEAD -- .carez-eval-fixture 2>&1)
        $ErrorActionPreference = $saved
        Set-Content -Path (Join-Path $caseDir "post-diff.patch") -Value $postPatch -Encoding UTF8

        $commands = @(Get-CommandRecords $eventsFile)
        $commands | ConvertTo-Json -Depth 6 | Set-Content -Path $commandsFile -Encoding UTF8
        $expected = $case.expected
        $caseIdPass = $false
        $outcomePass = $false
        $releasePass = $false
        $validationReportPass = $false
        if ($actual) {
            $caseIdPass = ([string]$actual.case_id -eq $id)
            $outcomePass = ([string]$actual.outcome -eq [string]$expected.outcome)
            $releasePass = ([string]$actual.release_status -eq [string]$expected.release_status)
            $validationReportPass = ([bool]$actual.validation_ran -eq [bool]$expected.validation_ran)
        }

        $headPass = ($postHead -eq $preHead -and $preHead -eq $baselineHead)
        $statePass = switch ([string]$expected.post_state) {
            "changed" { $postFingerprint -ne $preFingerprint }
            "same_as_pre" { $postFingerprint -eq $preFingerprint -and $postStatus -eq $preStatus }
            default { $false }
        }

        $allowedGlobs = @($expected.allowed_changed_globs)
        $pathsPass = Test-AllPathsAllowed $changedPaths $allowedGlobs
        if ([string]$expected.post_state -eq "changed" -and $changedPaths.Count -eq 0) {
            $pathsPass = $false
        }

        $requiredChecks = if ($expected.PSObject.Properties.Name -contains "required_contains") {
            @($expected.required_contains)
        } else { @() }
        $forbiddenChecks = if ($expected.PSObject.Properties.Name -contains "forbidden_contains") {
            @($expected.forbidden_contains)
        } else { @() }
        $requiredContentPass = Test-RequiredContent $worktree $requiredChecks
        $forbiddenContentPass = Test-ForbiddenContent $worktree $forbiddenChecks

        $globCountPass = $true
        if ($expected.PSObject.Properties.Name -contains "required_glob_count") {
            $globCountPass = Test-RequiredGlobCount $worktree $expected.required_glob_count
        }
        $globContentPass = $true
        if ($expected.PSObject.Properties.Name -contains "required_glob_contains") {
            $globContentPass = Test-RequiredGlobContent $worktree @($expected.required_glob_contains)
        }

        $validationNeedle = [string]$expected.validation_command
        $validationCommandCount = Get-CommandMatchCount $commands $validationNeedle
        $validationCommandPass = if ([bool]$expected.validation_ran) {
            $validationCommandCount -ge [int]$expected.validation_min_count
        }
        else {
            $validationCommandCount -eq 0
        }

        $requiredCommandNeedles = @($expected.required_command_contains)
        $caseForbiddenNeedles = @($expected.forbidden_command_contains)
        $requiredCommandsPass = Test-CommandContainsAll $commands $requiredCommandNeedles
        $forbiddenCommandsPass = Test-CommandContainsNone $commands (@($GlobalForbiddenCommands) + $caseForbiddenNeedles)
        $graderValidationPass = $true
        $graderValidationExit = $null
        $graderValidationOutput = @()
        if ([bool]$expected.validation_ran) {
            $validator = Join-Path $worktree ".carez-eval-fixture\validate.mjs"
            if (-not (Test-Path $validator)) {
                $graderValidationPass = $false
                $graderValidationExit = -1
                $graderValidationOutput = @("Validator missing: $validator")
            }
            else {
                $saved = $ErrorActionPreference
                $ErrorActionPreference = "Continue"
                $graderValidationOutput = @(& node $validator 2>&1)
                $graderValidationExit = $LASTEXITCODE
                $ErrorActionPreference = $saved
                $graderValidationPass = ($graderValidationExit -eq 0)
            }
        }
        Set-Content -Path (Join-Path $caseDir "grader-validation.txt") -Value $graderValidationOutput -Encoding UTF8

        $pass = (
            $exitCode -eq 0 -and
            $actual -and
            $caseIdPass -and
            $outcomePass -and
            $releasePass -and
            $validationReportPass -and
            $headPass -and
            $statePass -and
            $pathsPass -and
            $requiredContentPass -and
            $forbiddenContentPass -and
            $globCountPass -and
            $globContentPass -and
            $validationCommandPass -and
            $requiredCommandsPass -and
            $forbiddenCommandsPass -and
            $graderValidationPass
        )

        $record = [ordered]@{
            id = $id
            category = [string]$case.category
            fixture = [string]$case.fixture
            pass = [bool]$pass
            exit_code = $exitCode
            case_id_pass = [bool]$caseIdPass
            outcome_pass = [bool]$outcomePass
            release_status_pass = [bool]$releasePass
            validation_report_pass = [bool]$validationReportPass
            head_unchanged_pass = [bool]$headPass
            post_state_pass = [bool]$statePass
            changed_paths_pass = [bool]$pathsPass
            required_content_pass = [bool]$requiredContentPass
            forbidden_content_pass = [bool]$forbiddenContentPass
            glob_count_pass = [bool]$globCountPass
            glob_content_pass = [bool]$globContentPass
            validation_command_pass = [bool]$validationCommandPass
            required_commands_pass = [bool]$requiredCommandsPass
            forbidden_commands_pass = [bool]$forbiddenCommandsPass
            grader_validation_pass = [bool]$graderValidationPass
            validation_command_count = [int]$validationCommandCount
            grader_validation_exit = $graderValidationExit
            input_tokens = [int64]$usage.input_tokens
            cached_input_tokens = [int64]$usage.cached_input_tokens
            output_tokens = [int64]$usage.output_tokens
            reasoning_output_tokens = [int64]$usage.reasoning_output_tokens
            changed_paths = @($changedPaths)
            pre_status = @($preStatusLines)
            post_status = @($postStatusLines)
            pre_fixture_fingerprint = $preFingerprint
            post_fixture_fingerprint = $postFingerprint
            expected = $expected
            actual = $actual
            parse_error = $parseError
            worktree = $worktree
            events_file = $eventsFile
            result_file = $resultFile
            commands_file = $commandsFile
        }
    }
    catch {
        $parseError = $_.Exception.Message
        $record = [ordered]@{
            id = $id
            category = [string]$case.category
            fixture = [string]$case.fixture
            pass = $false
            exit_code = $exitCode
            input_tokens = [int64]0
            cached_input_tokens = [int64]0
            output_tokens = [int64]0
            reasoning_output_tokens = [int64]0
            parse_error = $parseError
            worktree = $worktree
            events_file = $eventsFile
            result_file = $resultFile
        }
    }
    finally {
        $cleanupPass = $true
        $cleanupOutput = @()
        if ($worktreeAdded -and -not $KeepWorktrees) {
            $saved = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            $cleanupOutput = @(git -C $Repo worktree remove --force $worktree 2>&1)
            $cleanupExit = $LASTEXITCODE
            git -C $Repo worktree prune | Out-Null
            $ErrorActionPreference = $saved
            $cleanupPass = ($cleanupExit -eq 0)
        }
        elseif ($KeepWorktrees) {
            $cleanupOutput = @("Worktree retained by -KeepWorktrees: $worktree")
        }
        Set-Content -Path (Join-Path $caseDir "worktree-cleanup.txt") -Value $cleanupOutput -Encoding UTF8
    }

    if ($record -is [System.Collections.IDictionary]) {
        $record["cleanup_pass"] = [bool]$cleanupPass
        if (-not $cleanupPass) { $record["pass"] = $false }
    }
    $Results += [pscustomobject]$record

    $label = if ([bool]$record.pass) { "PASS" } else { "FAIL" }
    Write-Host "$label $id"
}

$SourceFinalStatusLines = @(git status --porcelain=v1)
$SourceFinalStatus = ($SourceFinalStatusLines -join [Environment]::NewLine)
$SourceUnchanged = ($SourceInitialStatus -eq $SourceFinalStatus)
$ResultsPath = Join-Path $RunDir "results.jsonl"
$Results | ForEach-Object { $_ | ConvertTo-Json -Compress -Depth 14 } |
    Set-Content -Path $ResultsPath -Encoding UTF8

$Passed = @($Results | Where-Object { $_.pass }).Count
$Failed = $Results.Count - $Passed
$TotalInputTokens = ($Results | Measure-Object -Property input_tokens -Sum).Sum
$TotalCachedInputTokens = ($Results | Measure-Object -Property cached_input_tokens -Sum).Sum
$TotalOutputTokens = ($Results | Measure-Object -Property output_tokens -Sum).Sum
$TotalReasoningOutputTokens = ($Results | Measure-Object -Property reasoning_output_tokens -Sum).Sum

$Summary = [ordered]@{
    timestamp = (Get-Date).ToString("o")
    repository = $Repo
    model = $Model
    reasoning_effort = $ReasoningEffort
    suite = $Suite
    selected_cases = $Results.Count
    passed = $Passed
    failed = $Failed
    input_tokens = [int64]$TotalInputTokens
    cached_input_tokens = [int64]$TotalCachedInputTokens
    output_tokens = [int64]$TotalOutputTokens
    reasoning_output_tokens = [int64]$TotalReasoningOutputTokens
    source_repository_unchanged = [bool]$SourceUnchanged
    keep_worktrees = [bool]$KeepWorktrees
    output_directory = $RunDir
}
$Summary | ConvertTo-Json -Depth 6 |
    Set-Content -Path (Join-Path $RunDir "summary.json") -Encoding UTF8

Write-Host ""
Write-Host "CAREZ PHASE 6C EXECUTION EVAL SUMMARY"
$Results |
    Select-Object id, category, pass, outcome_pass, post_state_pass, changed_paths_pass, validation_command_pass, grader_validation_pass, forbidden_commands_pass, cleanup_pass |
    Format-Table -AutoSize
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"
Write-Host "Input tokens: $TotalInputTokens"
Write-Host "Cached input tokens: $TotalCachedInputTokens"
Write-Host "Output tokens: $TotalOutputTokens"
Write-Host "Reasoning output tokens: $TotalReasoningOutputTokens"
Write-Host "Source repository unchanged: $SourceUnchanged"
Write-Host "Results: $RunDir"
if (-not $SourceUnchanged) {
    Write-Error "BLOCKED: source checkout changed during disposable-worktree execution eval."
    exit 3
}
if ($Failed -gt 0) { exit 1 }
exit 0
