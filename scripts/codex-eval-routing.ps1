param(
    [ValidateSet("Smoke", "All")]
    [string]$Suite = "Smoke",

    [string]$CaseId,

    [switch]$Run,

    [string]$ReplayDir,

    [switch]$AllowDirty,

    [string]$Model = "gpt-6-luna",

    [ValidateSet("low", "medium", "high")]
    [string]$ReasoningEffort = "medium",

    [int]$MaxCases = 0,

    [string]$OutputRoot = (Join-Path $env:TEMP "carez-codex-evals")
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

function Get-Sha256Text {
    param([Parameter(Mandatory = $true)][string]$Text)

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        return (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join "")
    }
    finally {
        $sha.Dispose()
    }
}

function Get-RoutingConfigHash {
    param([Parameter(Mandatory = $true)][string]$Repo)

    $paths = @(
        (Join-Path $Repo "AGENTS.md"),
        (Join-Path $Repo "CODEX.md"),
        (Join-Path $Repo ".codex\config.toml")
    )

    $paths += @(Get-ChildItem (Join-Path $Repo ".agents\skills") -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
    $paths += @(Get-ChildItem (Join-Path $Repo ".codex\agents") -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })

    $chunks = @()
    foreach ($path in ($paths | Sort-Object -Unique)) {
        if (-not (Test-Path $path)) { continue }
        $relative = $path.Substring($Repo.Length).TrimStart("\", "/")
        $chunks += "FILE:$relative"
        $chunks += (Get-Content -Raw -Path $path)
    }

    return Get-Sha256Text ($chunks -join [Environment]::NewLine)
}

function Normalize-Set {
    param($Value)
    return @($Value | ForEach-Object { [string]$_ } | Sort-Object -Unique)
}

function Test-SetEqual {
    param($Left, $Right)
    $a = @(Normalize-Set $Left)
    $b = @(Normalize-Set $Right)
    if ($a.Count -ne $b.Count) { return $false }
    for ($i = 0; $i -lt $a.Count; $i++) {
        if ($a[$i] -ne $b[$i]) { return $false }
    }
    return $true
}

function Test-RoutingSet {
    param(
        $Actual,
        $Required,
        $Allowed,
        [bool]$HasAllowed,
        $Forbidden
    )

    $actualSet = @(Normalize-Set $Actual)
    $requiredSet = @(Normalize-Set $Required)
    $forbiddenSet = @(Normalize-Set $Forbidden)

    foreach ($item in $requiredSet) {
        if ($actualSet -notcontains $item) { return $false }
    }

    foreach ($item in $forbiddenSet) {
        if ($actualSet -contains $item) { return $false }
    }

    if ($HasAllowed) {
        $allowedSet = @(Normalize-Set (@($Required) + @($Allowed)))
        foreach ($item in $actualSet) {
            if ($allowedSet -notcontains $item) { return $false }
        }
        return $true
    }

    return (Test-SetEqual $actualSet $requiredSet)
}

$Repo = (git rev-parse --show-toplevel).Trim()
if (-not $Repo) { throw "Not inside a Git repository." }

$DataPath = Join-Path $Repo ".agents\evals\command-center-routing.jsonl"
$SmokePath = Join-Path $Repo ".agents\evals\smoke-cases.jsonl"
$SchemaPath = Join-Path $Repo ".agents\evals\schemas\routing-result.schema.json"
$RoutingConfigHash = Get-RoutingConfigHash $Repo

$Cases = @(Read-JsonLines $DataPath)
$SmokeRefs = @(Read-JsonLines $SmokePath)

if ($Cases.Count -ne 45) { throw "Golden dataset must contain exactly 45 cases; found $($Cases.Count)." }
$CaseIds = @($Cases | ForEach-Object { [string]$_.id })
if (($CaseIds | Sort-Object -Unique).Count -ne $Cases.Count) { throw "Golden dataset contains duplicate case IDs." }

if ($SmokeRefs.Count -ne 10) { throw "Smoke subset must contain exactly 10 case IDs; found $($SmokeRefs.Count)." }
$SmokeIds = @($SmokeRefs | ForEach-Object { [string]$_.id })
if (($SmokeIds | Sort-Object -Unique).Count -ne $SmokeIds.Count) { throw "Smoke subset contains duplicate case IDs." }
foreach ($id in $SmokeIds) {
    if ($CaseIds -notcontains $id) { throw "Smoke case '$id' is not present in the golden dataset." }
}

if (-not (Test-Path $SchemaPath)) { throw "Missing output schema: $SchemaPath" }
$null = Get-Content -Raw $SchemaPath | ConvertFrom-Json

if ($CaseId) {
    $Selected = @($Cases | Where-Object { $_.id -eq $CaseId })
    if ($Selected.Count -ne 1) { throw "Unknown case ID: $CaseId" }
} elseif ($Suite -eq "Smoke") {
    $byId = @{}
    foreach ($case in $Cases) { $byId[[string]$case.id] = $case }
    $Selected = @($SmokeIds | ForEach-Object { $byId[$_] })
} else {
    $Selected = @($Cases)
}

if ($MaxCases -gt 0) { $Selected = @($Selected | Select-Object -First $MaxCases) }

Write-Host "CAREZ COMMAND CENTER ROUTING EVAL"
Write-Host "Repository: $Repo"
Write-Host "Golden cases: $($Cases.Count)"
Write-Host "Smoke cases: $($SmokeIds.Count)"
Write-Host "Selected: $($Selected.Count)"
Write-Host "Model: $Model"
Write-Host "Reasoning: $ReasoningEffort"
Write-Host "Routing config hash: $RoutingConfigHash"
Write-Host "Live run: $Run"
Write-Host "Replay source: $ReplayDir"

if ($Run -and $ReplayDir) {
    throw "Use either -Run or -ReplayDir, not both."
}

if (-not $Run -and -not $ReplayDir) {
    Write-Host ""
    Write-Host "DRY RUN: no Codex model calls will be made."
    $Selected | Select-Object id, group, shape | Format-Table -AutoSize
    Write-Host "Add -Run to execute cases or -ReplayDir to rescore saved structured results without model usage."
    exit 0
}

$Branch = (git branch --show-current).Trim()
$InitialStatusLines = @(git status --porcelain=v1)
$InitialStatus = ($InitialStatusLines -join [Environment]::NewLine)
if ($Run -and $InitialStatusLines.Count -gt 0 -and -not $AllowDirty) {
    throw "Refusing live eval on a dirty working tree. Commit/clean the intended baseline or pass -AllowDirty explicitly."
}

if ($ReplayDir -and -not (Test-Path $ReplayDir)) {
    throw "Replay directory does not exist: $ReplayDir"
}

$Codex = if ($Run) { (Get-Command codex -ErrorAction Stop).Source } else { $null }
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RunName = if ($ReplayDir) { "replay-$Stamp" } else { $Stamp }
$RunDir = Join-Path $OutputRoot $RunName
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
$Results = @()

foreach ($case in $Selected) {
    $id = [string]$case.id
    $safeId = $id -replace '[^A-Za-z0-9_.-]', '_'
    $resultFile = Join-Path $RunDir ($safeId + ".result.json")
    $eventsFile = Join-Path $RunDir ($safeId + ".events.jsonl")
    $metaFile = Join-Path $RunDir ($safeId + ".meta.json")
    $promptHash = Get-Sha256Text ([string]$case.prompt)

    $routingPrompt = @"
CAREZ COMMAND CENTER ROUTING EVAL

This is a routing-policy evaluation only. Do not perform the simulated task.
You may read only the minimum local routing instructions needed to make the decision: the selected skill's SKILL.md completely, its directly required reference file(s) if the SKILL.md says they are needed before action, and relevant .codex/agents/*.toml metadata when agent routing is ambiguous.
Do not edit files, execute the simulated task, start servers, run tests, spawn agents, use web search, query remote services, commit, push, deploy, or mutate anything.

Using the Carez project instructions and the project skill/specialist metadata already available to this Codex session, report how a real task SHOULD be routed.

Return only the structured result required by the output schema.

Field rules:
- case_id: exactly "$id"
- selected_skills: exact Carez project skills that should govern the real task; [] when none applies
- spawn_agents: exact task-scoped specialists that should be spawned in the real task; [] when the parent should remain single-agent
- decision: proceed, clarify, investigate, map, review, or release_gate
- progressive_refs: only progressive-disclosure reference files the selected SKILL.md requires before the first task action; exclude references explicitly deferred to final review, browser QA, handoff, or later phases
- remote_actions: true only if the real task necessarily requires a remote query/mutation/action that is actually authorized; do not infer authorization
- reason: one concise routing justification, maximum two sentences

SIMULATED USER TASK:
$($case.prompt)
"@

    $reasoningConfig = 'model_reasoning_effort="' + $ReasoningEffort + '"'
    $webConfig = 'web_search="disabled"'
    # Codex 0.156.1 documents approval/sandbox/model flags in exec help, but the
    # Windows CLI parser requires these global options before the exec subcommand.
    $codexArgs = @(
        "-C", $Repo, "-s", "read-only", "-a", "never",
        "-m", $Model, "-c", $reasoningConfig, "-c", $webConfig,
        "exec", "--ephemeral",
        "--output-schema", $SchemaPath, "--json", "-o", $resultFile, "-"
    )

    Write-Host ""
    if ($ReplayDir) {
        Write-Host "REPLAY $id"
        $sourceResultFile = Join-Path $ReplayDir ($safeId + ".result.json")
        $sourceEventsFile = Join-Path $ReplayDir ($safeId + ".events.jsonl")
        $sourceMetaFile = Join-Path $ReplayDir ($safeId + ".meta.json")
        $eventLines = @()

        if (-not (Test-Path $sourceResultFile)) {
            $exitCode = 4
            $parseError = "Replay result missing: $sourceResultFile"
        }
        elseif (-not (Test-Path $sourceMetaFile)) {
            $exitCode = 5
            $parseError = "Replay metadata missing; rerun this case once under the fingerprinted harness: $sourceMetaFile"
        }
        else {
            $sourceMeta = Get-Content -Raw $sourceMetaFile | ConvertFrom-Json
            if ([string]$sourceMeta.prompt_hash -ne $promptHash) {
                $exitCode = 5
                $parseError = "Replay refused: prompt fingerprint changed for $id."
            }
            elseif ([string]$sourceMeta.routing_config_hash -ne $RoutingConfigHash) {
                $exitCode = 5
                $parseError = "Replay refused: Carez routing configuration changed for $id."
            }
            else {
                Copy-Item -Path $sourceResultFile -Destination $resultFile -Force
                Copy-Item -Path $sourceMetaFile -Destination $metaFile -Force
                if (Test-Path $sourceEventsFile) {
                    $eventLines = @(Get-Content -Path $sourceEventsFile)
                    $eventLines | Set-Content -Path $eventsFile -Encoding UTF8
                }
                $exitCode = 0
                $parseError = $null
            }
        }
    }
    else {
        Write-Host "RUN $id"

        # Feed the eval prompt through stdin and close it immediately. This avoids the
        # Windows CLI treating the non-interactive parent stdin as additional prompt input.
        $savedErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $eventLines = @($routingPrompt | & $Codex @codexArgs 2>&1)
        $exitCode = $LASTEXITCODE
        $ErrorActionPreference = $savedErrorActionPreference

        $eventLines | Set-Content -Path $eventsFile -Encoding UTF8
        $parseError = $null

        $meta = [ordered]@{
            case_id = $id
            prompt_hash = $promptHash
            routing_config_hash = $RoutingConfigHash
            model = $Model
            reasoning_effort = $ReasoningEffort
            created_at = (Get-Date).ToString("o")
        }
        $meta | ConvertTo-Json -Depth 4 | Set-Content -Path $metaFile -Encoding UTF8
    }

    $actual = $null
    if ($exitCode -eq 0 -and (Test-Path $resultFile)) {
        try { $actual = Get-Content -Raw $resultFile | ConvertFrom-Json }
        catch { $parseError = $_.Exception.Message }
    }

    $caseIdPass = $false
    $skillPass = $false
    $agentPass = $false
    $decisionPass = $false
    $refPass = $false
    $remotePass = $false
    if ($actual) {
        $caseIdPass = ([string]$actual.case_id -eq $id)

        $hasAllowedSkills = ($case.expected.PSObject.Properties.Name -contains "allowed_skills")
        $allowedSkills = if ($hasAllowedSkills) { $case.expected.allowed_skills } else { @() }
        $forbiddenSkills = if ($case.expected.PSObject.Properties.Name -contains "forbidden_skills") { $case.expected.forbidden_skills } else { @() }
        $skillPass = Test-RoutingSet $actual.selected_skills $case.expected.skills $allowedSkills $hasAllowedSkills $forbiddenSkills

        $hasAllowedAgents = ($case.expected.PSObject.Properties.Name -contains "allowed_agents")
        $allowedAgents = if ($hasAllowedAgents) { $case.expected.allowed_agents } else { @() }
        $forbiddenAgents = if ($case.expected.PSObject.Properties.Name -contains "forbidden_agents") { $case.expected.forbidden_agents } else { @() }
        $agentPass = Test-RoutingSet $actual.spawn_agents $case.expected.agents $allowedAgents $hasAllowedAgents $forbiddenAgents

        $decisionPass = ([string]$actual.decision -eq [string]$case.expected.decision)

        $hasAllowedRefs = ($case.expected.PSObject.Properties.Name -contains "allowed_progressive_refs")
        $allowedRefs = if ($hasAllowedRefs) { $case.expected.allowed_progressive_refs } else { @() }
        $forbiddenRefs = if ($case.expected.PSObject.Properties.Name -contains "forbidden_progressive_refs") { $case.expected.forbidden_progressive_refs } else { @() }
        $refPass = Test-RoutingSet $actual.progressive_refs $case.expected.progressive_refs $allowedRefs $hasAllowedRefs $forbiddenRefs

        $remotePass = ([bool]$actual.remote_actions -eq [bool]$case.expected.remote_actions)
    }

    $pass = ($exitCode -eq 0 -and $actual -and $caseIdPass -and $skillPass -and $agentPass -and $decisionPass -and $refPass -and $remotePass)

    $inputTokens = 0
    $cachedInputTokens = 0
    $outputTokens = 0
    $reasoningOutputTokens = 0
    $usageEventCount = 0
    foreach ($eventLine in $eventLines) {
        try {
            $event = ([string]$eventLine) | ConvertFrom-Json
            if ($event.type -eq "turn.completed" -and $event.usage) {
                $usageEventCount += 1
                $inputTokens += [int64]$event.usage.input_tokens
                $cachedInputTokens += [int64]$event.usage.cached_input_tokens
                $outputTokens += [int64]$event.usage.output_tokens
                $reasoningOutputTokens += [int64]$event.usage.reasoning_output_tokens
            }
        }
        catch {
            # Keep raw events even when a non-JSON stderr line is present.
        }
    }

    $record = [ordered]@{
        id = $id
        pass = [bool]$pass
        exit_code = $exitCode
        case_id_pass = [bool]$caseIdPass
        skills_pass = [bool]$skillPass
        agents_pass = [bool]$agentPass
        decision_pass = [bool]$decisionPass
        progressive_refs_pass = [bool]$refPass
        remote_actions_pass = [bool]$remotePass
        expected = $case.expected
        actual = $actual
        prompt_hash = $promptHash
        routing_config_hash = $RoutingConfigHash
        replayed = [bool]$ReplayDir
        extra_skills = if ($actual) { @(Normalize-Set $actual.selected_skills | Where-Object { @(Normalize-Set $case.expected.skills) -notcontains $_ }) } else { @() }
        extra_agents = if ($actual) { @(Normalize-Set $actual.spawn_agents | Where-Object { @(Normalize-Set $case.expected.agents) -notcontains $_ }) } else { @() }
        extra_progressive_refs = if ($actual) { @(Normalize-Set $actual.progressive_refs | Where-Object { @(Normalize-Set $case.expected.progressive_refs) -notcontains $_ }) } else { @() }
        parse_error = $parseError
        usage_event_count = $usageEventCount
        input_tokens = $inputTokens
        cached_input_tokens = $cachedInputTokens
        output_tokens = $outputTokens
        reasoning_output_tokens = $reasoningOutputTokens
        events_file = $eventsFile
        result_file = $resultFile
    }
    $Results += [pscustomobject]$record
    $label = if ($pass) { "PASS" } else { "FAIL" }
    Write-Host "$label $id"
}

$FinalStatusLines = @(git status --porcelain=v1)
$FinalStatus = ($FinalStatusLines -join [Environment]::NewLine)
$RepoUnchanged = ($InitialStatus -eq $FinalStatus)

$ResultsPath = Join-Path $RunDir "results.jsonl"
$Results | ForEach-Object { $_ | ConvertTo-Json -Compress -Depth 12 } | Set-Content -Path $ResultsPath -Encoding UTF8

$Passed = @($Results | Where-Object { $_.pass }).Count
$Failed = $Results.Count - $Passed
$TotalInputTokens = ($Results | Measure-Object -Property input_tokens -Sum).Sum
$TotalCachedInputTokens = ($Results | Measure-Object -Property cached_input_tokens -Sum).Sum
$TotalOutputTokens = ($Results | Measure-Object -Property output_tokens -Sum).Sum
$TotalReasoningOutputTokens = ($Results | Measure-Object -Property reasoning_output_tokens -Sum).Sum

$Summary = [ordered]@{
    timestamp = (Get-Date).ToString("o")
    repository = $Repo
    branch = $Branch
    model = $Model
    reasoning_effort = $ReasoningEffort
    routing_config_hash = $RoutingConfigHash
    replay_source = $ReplayDir
    selected_cases = $Results.Count
    passed = $Passed
    failed = $Failed
    input_tokens = [int64]$TotalInputTokens
    cached_input_tokens = [int64]$TotalCachedInputTokens
    output_tokens = [int64]$TotalOutputTokens
    reasoning_output_tokens = [int64]$TotalReasoningOutputTokens
    repository_unchanged = [bool]$RepoUnchanged
    output_directory = $RunDir
}

$SummaryPath = Join-Path $RunDir "summary.json"
$Summary | ConvertTo-Json -Depth 6 | Set-Content -Path $SummaryPath -Encoding UTF8

Write-Host ""
Write-Host "CAREZ ROUTING EVAL SUMMARY"
$Results | Select-Object id, pass, skills_pass, agents_pass, decision_pass, progressive_refs_pass, remote_actions_pass | Format-Table -AutoSize
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"
Write-Host "Input tokens: $TotalInputTokens"
Write-Host "Cached input tokens: $TotalCachedInputTokens"
Write-Host "Output tokens: $TotalOutputTokens"
Write-Host "Reasoning output tokens: $TotalReasoningOutputTokens"
Write-Host "Repository unchanged: $RepoUnchanged"
Write-Host "Results: $RunDir"

if (-not $RepoUnchanged) {
    Write-Error "BLOCKED: repository status changed during a read-only routing eval."
    exit 3
}
if ($Failed -gt 0) { exit 1 }
exit 0
