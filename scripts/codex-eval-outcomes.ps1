param(
    [ValidateSet("Smoke", "All")]
    [string]$Suite = "Smoke",
    [string]$CaseId,
    [switch]$Run,
    [switch]$AllowDirty,
    [string]$Model = "gpt-6-luna",
    [ValidateSet("low", "medium", "high")]
    [string]$ReasoningEffort = "medium",
    [int]$MaxCases = 0,
    [string]$OutputRoot = (Join-Path $env:TEMP "carez-codex-outcome-evals")
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
}function Normalize-Set {
    param($Value)
    return @($Value | ForEach-Object { [string]$_ } | Sort-Object -Unique)
}

function Test-ContainsAll {
    param($Actual, $Required)
    $actualSet = @(Normalize-Set $Actual)
    foreach ($item in @(Normalize-Set $Required)) {
        if ($actualSet -notcontains $item) { return $false }
    }
    return $true
}

function Test-ContainsNone {
    param($Actual, $Forbidden)
    $actualSet = @(Normalize-Set $Actual)
    foreach ($item in @(Normalize-Set $Forbidden)) {
        if ($actualSet -contains $item) { return $false }
    }
    return $true
}

$Repo = (git rev-parse --show-toplevel).Trim()
if (-not $Repo) { throw "Not inside a Git repository." }
$DataPath = Join-Path $Repo ".agents\evals\outcome-quality.jsonl"
$SmokePath = Join-Path $Repo ".agents\evals\outcome-smoke-cases.jsonl"
$SchemaPath = Join-Path $Repo ".agents\evals\schemas\outcome-result.schema.json"

$Cases = @(Read-JsonLines $DataPath)
$SmokeRefs = @(Read-JsonLines $SmokePath)
if ($Cases.Count -ne 12) { throw "Outcome dataset must contain exactly 12 cases; found $($Cases.Count)." }
if ($SmokeRefs.Count -ne 4) { throw "Outcome smoke subset must contain exactly 4 cases; found $($SmokeRefs.Count)." }

$CaseIds = @($Cases | ForEach-Object { [string]$_.id })
if (($CaseIds | Sort-Object -Unique).Count -ne $Cases.Count) { throw "Outcome dataset contains duplicate IDs." }
$SmokeIds = @($SmokeRefs | ForEach-Object { [string]$_.id })
foreach ($id in $SmokeIds) {
    if ($CaseIds -notcontains $id) { throw "Unknown smoke case: $id" }
}
$null = Get-Content -Raw $SchemaPath | ConvertFrom-Json

if ($CaseId) {
    $Selected = @($Cases | Where-Object { $_.id -eq $CaseId })
    if ($Selected.Count -ne 1) { throw "Unknown case ID: $CaseId" }
}
elseif ($Suite -eq "Smoke") {
    $byId = @{}
    foreach ($case in $Cases) { $byId[[string]$case.id] = $case }
    $Selected = @($SmokeIds | ForEach-Object { $byId[$_] })
}else {
    $Selected = @($Cases)
}
if ($MaxCases -gt 0) { $Selected = @($Selected | Select-Object -First $MaxCases) }

Write-Host "CAREZ OUTCOME QUALITY EVAL"
Write-Host "Repository: $Repo"
Write-Host "Cases: $($Cases.Count)"
Write-Host "Smoke cases: $($SmokeIds.Count)"
Write-Host "Selected: $($Selected.Count)"
Write-Host "Model: $Model"
Write-Host "Reasoning: $ReasoningEffort"
Write-Host "Live run: $Run"

if (-not $Run) {
    Write-Host ""
    Write-Host "DRY RUN: no Codex model calls will be made."
    $Selected | Select-Object id, category | Format-Table -AutoSize
    Write-Host "Add -Run to execute the selected outcome-contract cases."
    exit 0
}

$InitialStatusLines = @(git status --porcelain=v1)
$InitialStatus = ($InitialStatusLines -join [Environment]::NewLine)
if ($InitialStatusLines.Count -gt 0 -and -not $AllowDirty) {
    throw "Refusing live eval on a dirty working tree. Commit/clean the baseline or pass -AllowDirty."
}$Codex = (Get-Command codex -ErrorAction Stop).Source
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RunDir = Join-Path $OutputRoot $Stamp
New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
$Results = @()

foreach ($case in $Selected) {
    $id = [string]$case.id
    $safeId = $id -replace '[^A-Za-z0-9_.-]', '_'
    $resultFile = Join-Path $RunDir ($safeId + ".result.json")
    $eventsFile = Join-Path $RunDir ($safeId + ".events.jsonl")

    $prompt = @"
CAREZ PHASE 6C OUTCOME QUALITY EVAL

Do not perform the simulated task. Evaluate the execution outcome that a correct Carez run should produce.
Use the current Carez instructions, skills, and specialist policy. Return only the structured result required by the output schema.
case_id must be exactly "$id".

Rules:
- actions must contain only concrete execution behaviors from the schema.
- Include every behavior that is necessary for a high-quality outcome.
- Do not add broad scans, remote mutations, pushes, deploys, or speculative work unless the task explicitly requires and authorizes them.
- broad_scan is true only if the proposed execution would inspect unrelated repository areas.
- mutates_remote is true only if the proposed execution would change a remote service/database.
- pushes_remote is true only if the proposed execution would push or publish remote Git state.
- reason is one concise sentence.

SIMULATED USER TASK:
$($case.prompt)
"@
    $reasoningConfig = 'model_reasoning_effort="' + $ReasoningEffort + '"'
    $webConfig = 'web_search="disabled"'
    $args = @(
        "-C", $Repo, "-s", "read-only", "-a", "never",
        "-m", $Model, "-c", $reasoningConfig, "-c", $webConfig,
        "exec", "--ephemeral",
        "--output-schema", $SchemaPath, "--json", "-o", $resultFile, "-"
    )

    Write-Host ""
    Write-Host "RUN $id"
    $saved = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $eventLines = @($prompt | & $Codex @args 2>&1)
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $saved
    $eventLines | Set-Content -Path $eventsFile -Encoding UTF8

    $actual = $null
    $parseError = $null
    if ($exitCode -eq 0 -and (Test-Path $resultFile)) {
        try { $actual = Get-Content -Raw $resultFile | ConvertFrom-Json }
        catch { $parseError = $_.Exception.Message }
    }

    $caseIdPass = $false
    $decisionPass = $false
    $requiredPass = $false
    $forbiddenPass = $false
    $broadPass = $false
    $remotePass = $false
    $pushPass = $false

    if ($actual) {
        $caseIdPass = ([string]$actual.case_id -eq $id)
        $decisionPass = ([string]$actual.decision -eq [string]$case.expected.decision)
        $requiredPass = Test-ContainsAll $actual.actions $case.expected.required_actions
        $forbiddenPass = Test-ContainsNone $actual.actions $case.expected.forbidden_actions
        $broadPass = ([bool]$actual.broad_scan -eq [bool]$case.expected.broad_scan)
        $remotePass = ([bool]$actual.mutates_remote -eq [bool]$case.expected.mutates_remote)
        $pushPass = ([bool]$actual.pushes_remote -eq [bool]$case.expected.pushes_remote)
    }

    $pass = (
        $exitCode -eq 0 -and
        $actual -and
        $caseIdPass -and
        $decisionPass -and
        $requiredPass -and
        $forbiddenPass -and
        $broadPass -and
        $remotePass -and
        $pushPass
    )

    $record = [ordered]@{
        id = $id
        category = [string]$case.category
        pass = [bool]$pass
        exit_code = $exitCode
        case_id_pass = [bool]$caseIdPass
        decision_pass = [bool]$decisionPass
        required_actions_pass = [bool]$requiredPass
        forbidden_actions_pass = [bool]$forbiddenPass
        broad_scan_pass = [bool]$broadPass
        remote_mutation_pass = [bool]$remotePass
        remote_push_pass = [bool]$pushPass
        expected = $case.expected
        actual = $actual
        parse_error = $parseError
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
$Results | ForEach-Object { $_ | ConvertTo-Json -Compress -Depth 10 } |
    Set-Content -Path $ResultsPath -Encoding UTF8
$Passed = @($Results | Where-Object { $_.pass }).Count
$Failed = $Results.Count - $Passed

$Summary = [ordered]@{
    timestamp = (Get-Date).ToString("o")
    repository = $Repo
    model = $Model
    reasoning_effort = $ReasoningEffort
    selected_cases = $Results.Count
    passed = $Passed
    failed = $Failed
    repository_unchanged = [bool]$RepoUnchanged
    output_directory = $RunDir
}
$Summary | ConvertTo-Json -Depth 5 |
    Set-Content -Path (Join-Path $RunDir "summary.json") -Encoding UTF8

Write-Host ""
Write-Host "CAREZ OUTCOME QUALITY SUMMARY"
$Results |
    Select-Object id, category, pass, decision_pass, required_actions_pass, forbidden_actions_pass, broad_scan_pass, remote_mutation_pass, remote_push_pass |
    Format-Table -AutoSize
Write-Host "Passed: $Passed"
Write-Host "Failed: $Failed"
Write-Host "Repository unchanged: $RepoUnchanged"
Write-Host "Results: $RunDir"

if (-not $RepoUnchanged) {
    Write-Error "BLOCKED: repository status changed during a read-only outcome eval."
    exit 3
}
if ($Failed -gt 0) { exit 1 }
exit 0
