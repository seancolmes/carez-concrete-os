[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("GitHub", "Supabase", "Vercel")]
    [string]$Provider,

    [Parameter(Mandatory = $true)]
    [string]$Operation,

    [ValidateSet("staging", "production")]
    [string]$Environment = "staging",

    [string]$Repository = "seancolmes/carez-concrete-os",
    [string]$Branch = "staging",
    [string]$Commit,
    [string]$RunId,
    [string]$PullRequest,
    [string]$ProjectRef,
    [string]$Target,

    [string]$RepoRoot,

    [switch]$Run
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Write-EvidenceHeader {
    param(
        [string]$ProviderName,
        [string]$OperationName,
        [string]$TargetEnvironment,
        [bool]$Live
    )

    [pscustomobject]@{
        source = $ProviderName
        authority_class = "external_state"
        environment = $TargetEnvironment
        scope = $OperationName
        freshness = if ($Live) { (Get-Date).ToString("o") } else { "not-queried-dry-run" }
        side_effect_class = if ($Live) { "read" } else { "none" }
        remote_write = $false
        dry_run = -not $Live
    } | ConvertTo-Json -Compress
}

function Require-Value {
    param(
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "$Name is required for $Provider/$Operation."
    }
}

function Invoke-ReadCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Executable,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    if (-not $Run) {
        Write-Host ("DRY RUN: " + $Executable + " " + ($Arguments -join " "))
        return
    }

    & $Executable @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "$Provider/$Operation read failed with exit code $LASTEXITCODE."
    }
}

$Allowed = @{
    GitHub = @("BranchState", "CommitChecks", "WorkflowRun", "PullRequest")
    Supabase = @("MigrationState")
    Vercel = @("Deployment", "DeploymentLogs", "Alias")
}

if ($Allowed[$Provider] -notcontains $Operation) {
    throw "Unsupported read operation '$Operation' for $Provider. Allowed: $($Allowed[$Provider] -join ', ')."
}

Write-EvidenceHeader -ProviderName $Provider -OperationName $Operation -TargetEnvironment $Environment -Live ([bool]$Run)

switch ($Provider) {
    "GitHub" {
        $Gh = (Get-Command gh -ErrorAction Stop).Source

        switch ($Operation) {
            "BranchState" {
                Require-Value "Repository" $Repository
                Require-Value "Branch" $Branch

                Invoke-ReadCommand $Gh @(
                    "api",
                    "-X", "GET",
                    "repos/$Repository/branches/$Branch",
                    "--jq",
                    "{name:.name,sha:.commit.sha,protected:.protected}"
                )
            }

            "CommitChecks" {
                Require-Value "Repository" $Repository
                Require-Value "Commit" $Commit

                Invoke-ReadCommand $Gh @(
                    "api",
                    "-X", "GET",
                    "-H", "Accept: application/vnd.github+json",
                    "repos/$Repository/commits/$Commit/check-runs",
                    "--jq",
                    "{total_count:.total_count,check_runs:[.check_runs[]|{name,status,conclusion,started_at,completed_at,html_url}]}"
                )
            }

            "WorkflowRun" {
                Require-Value "Repository" $Repository
                Require-Value "RunId" $RunId

                Invoke-ReadCommand $Gh @(
                    "run", "view", $RunId,
                    "-R", $Repository,
                    "--json",
                    "attempt,conclusion,createdAt,databaseId,event,headBranch,headSha,name,status,updatedAt,url,workflowName"
                )
            }

            "PullRequest" {
                Require-Value "Repository" $Repository
                Require-Value "PullRequest" $PullRequest

                Invoke-ReadCommand $Gh @(
                    "pr", "view", $PullRequest,
                    "-R", $Repository,
                    "--json",
                    "number,state,title,headRefName,baseRefName,isDraft,mergeStateStatus,statusCheckRollup,url"
                )
            }
        }
    }

    "Supabase" {
        $Supabase = Join-Path $RepoRoot "node_modules\.bin\supabase.cmd"

        if (-not (Test-Path $Supabase)) {
            throw "Local Supabase CLI is missing at $Supabase. Run pnpm install in the Carez repository; do not install an alternate global CLI."
        }

        if ($Operation -eq "MigrationState") {
            Require-Value "ProjectRef" $ProjectRef

            $LinkedRefPath = Join-Path $RepoRoot "supabase\.temp\project-ref"

            if (-not (Test-Path $LinkedRefPath)) {
                throw "Supabase project identity is not locally linked. Refusing to guess a remote target."
            }

            $LinkedRef = (Get-Content -Raw $LinkedRefPath).Trim()

            if ($LinkedRef -ne $ProjectRef) {
                throw "Supabase target mismatch: linked project '$LinkedRef' does not match explicitly requested '$ProjectRef'."
            }

            Invoke-ReadCommand $Supabase @(
                "migration", "list",
                "--linked",
                "--workdir", $RepoRoot,
                "--output-format", "json"
            )
        }
    }

    "Vercel" {
        $Vercel = Join-Path $env:LOCALAPPDATA "Carez\CommandCenter\vercel-cli\node_modules\.bin\vercel.cmd"

        if (-not (Test-Path $Vercel)) {
            throw "Carez Command Center Vercel CLI is missing at $Vercel."
        }

        Require-Value "Target" $Target

        switch ($Operation) {
            "Deployment" {
                Invoke-ReadCommand $Vercel @(
                    "inspect", $Target,
                    "--json",
                    "--non-interactive",
                    "--cwd", $RepoRoot
                )
            }

            "DeploymentLogs" {
                Invoke-ReadCommand $Vercel @(
                    "inspect", $Target,
                    "--logs",
                    "--non-interactive",
                    "--cwd", $RepoRoot
                )
            }

            "Alias" {
                Invoke-ReadCommand $Vercel @(
                    "inspect", $Target,
                    "--json",
                    "--non-interactive",
                    "--cwd", $RepoRoot
                )
            }
        }
    }
}

if (-not $Run) {
    Write-Host "No remote provider was contacted. Re-run with -Run only when current remote truth is materially required."
}
