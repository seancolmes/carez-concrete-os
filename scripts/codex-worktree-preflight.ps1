$ErrorActionPreference = "Stop"

$Repo = (git rev-parse --show-toplevel).Trim()
if (-not $Repo) {
    Write-Error "Not inside a Git repository."
    exit 2
}

$Branch = (git branch --show-current).Trim()
$Head = (git rev-parse --short HEAD).Trim()
$Status = @(git status --porcelain)
$Worktrees = @(git worktree list --porcelain | Select-String '^worktree ')

Write-Host "CAREZ WORKTREE PREFLIGHT"
Write-Host "Repository: $Repo"
Write-Host "Branch: $Branch"
Write-Host "HEAD: $Head"
Write-Host "Changed paths: $($Status.Count)"
Write-Host "Registered Git worktrees: $($Worktrees.Count)"
Write-Host "Environment file: $((Test-Path (Join-Path $Repo '.codex\environments\environment.toml')))"
Write-Host "Worktree include: $((Test-Path (Join-Path $Repo '.worktreeinclude')))"
Write-Host ".env.local available: $((Test-Path (Join-Path $Repo '.env.local')))"

if ($Branch -ne "staging") {
    Write-Host "BLOCKED: Carez managed worktrees normally start from staging. Use another base only with explicit task authorization."
    exit 2
}

if ($Status.Count -gt 0) {
    Write-Host "NOTICE: The local checkout is dirty. Codex-managed worktrees can carry the current local changes into the new worktree. Confirm that snapshot is intended."
} else {
    Write-Host "Local checkout is clean."
}

Write-Host "READY: Starting a managed worktree will not switch or rewrite the local staging checkout."
