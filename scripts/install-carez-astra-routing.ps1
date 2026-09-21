[CmdletBinding()]
param(
    [string]$CodexHome = $env:CODEX_HOME,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($CodexHome)) {
    $CodexHome = Join-Path $HOME ".codex"
}

$CodexHome = [System.IO.Path]::GetFullPath($CodexHome)
$OmniRouteHome = [System.IO.Path]::GetFullPath((Join-Path $HOME ".codex-omniroute"))

if ($CodexHome.TrimEnd('\') -ieq $OmniRouteHome.TrimEnd('\')) {
    throw "Refusing to install the hosted Astra profile into the local OmniRoute CODEX_HOME. Use the normal ChatGPT-authenticated Codex home or pass -CodexHome explicitly."
}

$RepoRoot = Split-Path $PSScriptRoot -Parent
$TemplateRoot = Join-Path $RepoRoot "tools\codex\carez-astra"

$ProfileSource = Join-Path $TemplateRoot "carez-astra.config.toml"
$LunaSource = Join-Path $TemplateRoot "agents\luna-worker.toml"
$TerraSource = Join-Path $TemplateRoot "agents\terra-worker.toml"

foreach ($Source in @($ProfileSource, $LunaSource, $TerraSource)) {
    if (-not (Test-Path $Source)) {
        throw "Missing routing template: $Source"
    }
}

$ProfileTarget = Join-Path $CodexHome "carez-astra.config.toml"
$AgentsDir = Join-Path $CodexHome "agents"
$LunaTarget = Join-Path $AgentsDir "luna-worker.toml"
$TerraTarget = Join-Path $AgentsDir "terra-worker.toml"

$Targets = @(
    @{ Source = $ProfileSource; Target = $ProfileTarget },
    @{ Source = $LunaSource; Target = $LunaTarget },
    @{ Source = $TerraSource; Target = $TerraTarget }
)

if ($DryRun) {
    Write-Host "Carez Astra routing dry run"
    Write-Host "CODEX_HOME: $CodexHome"
    foreach ($Item in $Targets) {
        Write-Host ("COPY {0} -> {1}" -f $Item.Source, $Item.Target)
    }
    Write-Host ""
    Write-Host "No files changed."
    exit 0
}

New-Item -ItemType Directory -Force -Path $CodexHome | Out-Null
New-Item -ItemType Directory -Force -Path $AgentsDir | Out-Null

$Stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$BackupDir = Join-Path $CodexHome "backups\carez-astra-$Stamp"
$BackedUp = $false

foreach ($Item in $Targets) {
    if (Test-Path $Item.Target) {
        if (-not $BackedUp) {
            New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
            $BackedUp = $true
        }
        Copy-Item -Force $Item.Target (Join-Path $BackupDir ([System.IO.Path]::GetFileName($Item.Target)))
    }
}

foreach ($Item in $Targets) {
    Copy-Item -Force $Item.Source $Item.Target
}

Write-Host "Installed Carez token-efficient Astra profile."
Write-Host "CODEX_HOME: $CodexHome"
if ($BackedUp) {
    Write-Host "Backup: $BackupDir"
}
Write-Host ""
Write-Host "This installer did NOT modify config.toml, AGENTS.md, auth.json, MCP servers, plugins, notify settings, or provider credentials."
Write-Host ""
Write-Host "Prerequisite: Superpowers and Impeccable should already be installed/enabled in the hosted Codex plugin environment."
Write-Host ""
Write-Host "Recommended premium launcher:"
Write-Host '  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-carez-astra.ps1'
Write-Host ""
Write-Host "Direct profile start (leaves any Impeccable automatic hooks active):"
Write-Host '  codex --profile carez-astra'
Write-Host ""
Write-Host "The premium profile is for hosted ChatGPT-authenticated Codex. The existing .codex-omniroute local workflow remains separate."
