param(
    [string]$CommitMessage = "chore: automated workspace sync",
    [switch]$StageAll,
    [switch]$SkipDatabase
)

$ErrorActionPreference = "Stop"

$ExpectedQaProjectRef = "tkcirsdfvvahwrcratkn"

function Assert-CommandSuccess {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Step
    )

    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "   CAREZ WORKSPACE AUTOMATION // STARTING SYNC" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# -----------------------------------------------------
# PREFLIGHT
# -----------------------------------------------------

$currentBranch = (git branch --show-current).Trim()
Assert-CommandSuccess "Current branch detection"

if ([string]::IsNullOrWhiteSpace($currentBranch)) {
    throw "Git is currently in detached HEAD state. Sync cancelled."
}

if ($currentBranch -eq "main") {
    throw "Production branch 'main' is protected. Sync cancelled."
}

Write-Host "Branch: $currentBranch" -ForegroundColor DarkGray

# -----------------------------------------------------
# 1. SUPABASE QA DATABASE
# -----------------------------------------------------

if (-not $SkipDatabase) {
    if (Test-Path "supabase/migrations") {
        Write-Host "`n[1/3] Verifying Supabase QA target..." -ForegroundColor Yellow

        $projectRefPath = ".\supabase\.temp\project-ref"

        if (-not (Test-Path $projectRefPath)) {
            throw "Supabase project is not linked. Expected QA project $ExpectedQaProjectRef."
        }

        $actualProjectRef = (Get-Content $projectRefPath -Raw).Trim()

        if ($actualProjectRef -ne $ExpectedQaProjectRef) {
            throw "Supabase target mismatch. Expected QA $ExpectedQaProjectRef but found $actualProjectRef."
        }

        Write-Host "OK Supabase QA target verified: $actualProjectRef" -ForegroundColor Green

        Write-Host "Running migration dry-run..." -ForegroundColor DarkGray
        pnpm exec supabase db push --dry-run
        Assert-CommandSuccess "Supabase database dry-run"

        Write-Host "Applying pending QA migrations..." -ForegroundColor DarkGray
        pnpm exec supabase db push
        Assert-CommandSuccess "Supabase database push"

        Write-Host "OK QA database synchronized." -ForegroundColor Green
    }
    else {
        Write-Host "`n[1/3] No Supabase migrations directory. Skipping database push." -ForegroundColor DarkGray
    }
}
else {
    Write-Host "`n[1/3] Database synchronization skipped by request." -ForegroundColor DarkGray
}

# -----------------------------------------------------
# 2. OPTIONAL STAGE + COMMIT
# -----------------------------------------------------

Write-Host "`n[2/3] Inspecting workspace..." -ForegroundColor Yellow

if ($StageAll) {
    Write-Host "Explicit -StageAll supplied. Staging workspace changes..." -ForegroundColor Yellow

    git add -A
    Assert-CommandSuccess "Git staging"
}
else {
    Write-Host "Automatic staging disabled. Existing staged changes only." -ForegroundColor DarkGray
}

git diff --cached --quiet
$stagedExitCode = $LASTEXITCODE

if ($stagedExitCode -gt 1) {
    throw "Unable to inspect staged Git changes."
}

$hasStagedChanges = ($stagedExitCode -eq 1)

if ($hasStagedChanges) {
    git commit -m $CommitMessage
    Assert-CommandSuccess "Git commit"

    Write-Host "OK Staged workspace changes committed." -ForegroundColor Green
}
else {
    Write-Host "No staged changes. No commit created." -ForegroundColor DarkGray
}

$workingChanges = git status --porcelain

if ($workingChanges) {
    Write-Host "`nLocal unstaged/untracked files remain untouched:" -ForegroundColor Yellow
    $workingChanges | ForEach-Object {
        Write-Host "  $_" -ForegroundColor DarkGray
    }
}

# -----------------------------------------------------
# 3. PUSH CURRENT FEATURE/STAGING BRANCH
# -----------------------------------------------------

Write-Host "`n[3/3] Pushing branch to GitHub..." -ForegroundColor Yellow

git push origin $currentBranch
Assert-CommandSuccess "Git push"

Write-Host "`n=====================================================" -ForegroundColor Green
Write-Host "   SYNC COMPLETE" -ForegroundColor Green
Write-Host "   Branch: $currentBranch" -ForegroundColor Green
Write-Host "   QA database target: $ExpectedQaProjectRef" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green