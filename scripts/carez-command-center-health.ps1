[CmdletBinding()]
param(
    [string]$RepoRoot,
    [switch]$StrictBrowser
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}
$Checks = [System.Collections.Generic.List[object]]::new()

function Add-Check {
    param(
        [string]$Component,
        [ValidateSet("PASS", "WARN", "BLOCK")]
        [string]$Level,
        [string]$Detail
    )

    $Checks.Add([pscustomobject]@{
        Component = $Component
        Level = $Level
        Detail = $Detail
    })
}

function Test-OutputContains {
    param(
        [string]$Text,
        [string]$Pattern
    )

    return [bool]($Text -match $Pattern)
}

$CbmExe = Join-Path $env:LOCALAPPDATA "Carez\CommandCenter\codebase-memory-mcp\codebase-memory-mcp.exe"
$AimExe = Join-Path $env:LOCALAPPDATA "Carez\CommandCenter\ai-memory\ai-memory.exe"
$AimData = Join-Path $env:LOCALAPPDATA "Carez\CommandCenter\ai-memory-data"
$BskExe = Join-Path $env:LOCALAPPDATA "Carez\CommandCenter\bsk\bsk.exe"
$BskHome = Join-Path $env:LOCALAPPDATA "Carez\CommandCenter\bsk-home"
if (Test-Path (Join-Path $RepoRoot ".git")) {
    Add-Check "Carez repository" "PASS" $RepoRoot
}
else {
    Add-Check "Carez repository" "BLOCK" "No .git directory found at $RepoRoot"
}

if (Test-Path (Join-Path $RepoRoot ".ai-memory.toml")) {
    Add-Check "ai-memory scope marker" "PASS" ".ai-memory.toml present"
}
else {
    Add-Check "ai-memory scope marker" "BLOCK" ".ai-memory.toml missing"
}

if (Test-Path $CbmExe) {
    $CbmVersion = (& $CbmExe --version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -eq 0) {
        Add-Check "codebase-memory binary" "PASS" $CbmVersion
    }
    else {
        Add-Check "codebase-memory binary" "BLOCK" "Version probe failed"
    }

    $CbmConfig = (& $CbmExe config list 2>&1 | Out-String)

    $UnsafeCbm = @(
        "auto_index\s*=\s*true",
        "auto_watch\s*=\s*true",
        "watcher_enabled\s*=\s*true",
        "ui_enabled\s*=\s*true"
    ) | Where-Object { Test-OutputContains $CbmConfig $_ }

    if ($UnsafeCbm.Count -eq 0) {
        Add-Check "codebase-memory background automation" "PASS" "auto-index/watch/watcher/UI disabled"
    }
    else {
        Add-Check "codebase-memory background automation" "BLOCK" ("Unexpected enabled setting: " + ($UnsafeCbm -join ", "))
    }
}
else {
    Add-Check "codebase-memory binary" "BLOCK" "Missing: $CbmExe"
}
if (Test-Path $AimExe) {
    $SavedPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $AimStatus = (& $AimExe --data-dir $AimData status 2>&1 | Out-String)
    $AimExit = $LASTEXITCODE
    $ErrorActionPreference = $SavedPreference

    if ($AimExit -eq 0 -and (Test-OutputContains $AimStatus "capture mode:\s*allowlist")) {
        Add-Check "ai-memory server" "PASS" "Loopback server answering with allowlist capture"
    }
    elseif ($AimExit -eq 0) {
        Add-Check "ai-memory server" "BLOCK" "Server answered but capture mode was not allowlist"
    }
    else {
        Add-Check "ai-memory server" "BLOCK" "Status probe failed"
    }

    $Listener = Get-NetTCPConnection -State Listen -LocalPort 49374 -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($Listener -and $Listener.LocalAddress -eq "127.0.0.1") {
        Add-Check "ai-memory bind" "PASS" "127.0.0.1:49374"
    }
    elseif ($Listener) {
        Add-Check "ai-memory bind" "BLOCK" ("Unexpected listen address: " + $Listener.LocalAddress)
    }
    else {
        Add-Check "ai-memory bind" "BLOCK" "No listener on 127.0.0.1:49374"
    }
}
else {
    Add-Check "ai-memory binary" "BLOCK" "Missing: $AimExe"
}

$CodexConfig = Join-Path $env:USERPROFILE ".codex\config.toml"
$CodexHooks = Join-Path $env:USERPROFILE ".codex\hooks.json"

if ((Test-Path $CodexConfig) -and (Test-Path $CodexHooks)) {
    $CodexConfigText = Get-Content -Raw $CodexConfig
    $CodexHooksText = Get-Content -Raw $CodexHooks

    if (
        $CodexConfigText -match '\[mcp_servers\.codebase-memory-mcp\]' -and
        $CodexConfigText -match '--tool-profile=analysis' -and
        $CodexConfigText -match '\[mcp_servers\.ai-memory\]' -and
        $CodexConfigText -match '127\.0\.0\.1:49374/mcp'
    ) {
        Add-Check "Codex knowledge MCPs" "PASS" "codebase-memory analysis profile + loopback ai-memory MCP configured"
    }
    else {
        Add-Check "Codex knowledge MCPs" "BLOCK" "Expected bounded codebase-memory/ai-memory MCP configuration is incomplete"
    }

    if (
        $CodexHooksText -match '"SessionStart"' -and
        $CodexHooksText -match '"Stop"' -and
        $CodexHooksText -notmatch '"UserPromptSubmit"'
    ) {
        Add-Check "Codex memory hooks" "PASS" "lifecycle hooks present; prompt capture hook intentionally absent"
    }
    else {
        Add-Check "Codex memory hooks" "BLOCK" "Expected bounded ai-memory lifecycle hook shape is not present"
    }

    $RawProviderMcpPattern = '(?m)^\[mcp_servers\.(github|supabase|vercel)(\.|\])'
    if ($CodexConfigText -match $RawProviderMcpPattern) {
        Add-Check "Phase 10 mutation capability" "BLOCK" "Raw GitHub/Supabase/Vercel MCP detected while provider mutation capability is disabled"
    }
    else {
        Add-Check "Phase 10 mutation capability" "PASS" "No raw GitHub/Supabase/Vercel MCP enabled"
    }
}
else {
    Add-Check "Codex memory integration" "BLOCK" "Expected Codex config/hooks are incomplete"
}

$AimConfig = Join-Path $AimData "config.toml"
if (Test-Path $AimConfig) {
    $AimConfigText = Get-Content -Raw $AimConfig
    if (
        $AimConfigText -match 'embedding_provider\s*=\s*"none"' -and
        $AimConfigText -match '(?s)\[auto_improve\].*?require_approval\s*=\s*true' -and
        $AimConfigText -match '(?s)\[auto_improve\.scheduler\].*?enabled\s*=\s*false' -and
        $AimConfigText -match '(?s)\[routing\].*?mid_session\s*=\s*"sticky"'
    ) {
        Add-Check "ai-memory autonomous behavior" "PASS" "embeddings/auto-improve disabled; approval required; sticky project routing"
    }
    else {
        Add-Check "ai-memory autonomous behavior" "BLOCK" "Carez ai-memory safety settings drifted"
    }
}
else {
    Add-Check "ai-memory autonomous behavior" "BLOCK" "Missing ai-memory config.toml"
}
if (Test-Path $BskExe) {
    $env:BSK_HOME = $BskHome
    $DoctorRaw = (& $BskExe doctor --json 2>&1 | Out-String).Trim()

    try {
        $Doctor = @($DoctorRaw | ConvertFrom-Json)
        $HardFailures = @(
            $Doctor |
                Where-Object { -not $_.ok -and $_.name -ne "extension connected" }
        )
        $ExtensionFailure = @(
            $Doctor |
                Where-Object { -not $_.ok -and $_.name -eq "extension connected" }
        )

        if ($HardFailures.Count -gt 0) {
            Add-Check "BrowserSkill" "BLOCK" (($HardFailures | ForEach-Object { $_.name + ": " + $_.detail }) -join "; ")
        }
        elseif ($ExtensionFailure.Count -gt 0) {
            $Level = if ($StrictBrowser) { "BLOCK" } else { "WARN" }
            Add-Check "BrowserSkill extension" $Level "CLI/daemon healthy; browser extension not connected"
        }
        else {
            $BrowserRaw = (& $BskExe browsers --json 2>&1 | Out-String).Trim()
            try {
                $Browsers = @($BrowserRaw | ConvertFrom-Json)
                $CarezQaBrowsers = @($Browsers | Where-Object { [string]$_.label -eq "Carez QA" })

                if ($CarezQaBrowsers.Count -eq 1) {
                    Add-Check "BrowserSkill" "PASS" "Dedicated Carez QA browser connected"
                }
                elseif ($CarezQaBrowsers.Count -gt 1) {
                    Add-Check "BrowserSkill" "BLOCK" "More than one browser is labeled Carez QA"
                }
                else {
                    $Level = if ($StrictBrowser) { "BLOCK" } else { "WARN" }
                    Add-Check "BrowserSkill QA profile" $Level "No connected browser is labeled exactly 'Carez QA'"
                }
            }
            catch {
                Add-Check "BrowserSkill" "BLOCK" "Browser inventory output was not valid JSON"
            }
        }
    }
    catch {
        Add-Check "BrowserSkill" "BLOCK" "Doctor output was not valid JSON"
    }
}
else {
    Add-Check "BrowserSkill binary" "BLOCK" "Missing: $BskExe"
}

$ProviderRead = Join-Path $RepoRoot "scripts\carez-provider-read.ps1"
if (Test-Path $ProviderRead) {
    $ProviderTokens = $null
    $ProviderParseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        $ProviderRead,
        [ref]$ProviderTokens,
        [ref]$ProviderParseErrors
    ) | Out-Null

    if ($ProviderParseErrors.Count -gt 0) {
        Add-Check "Provider read adapter" "BLOCK" "carez-provider-read.ps1 has PowerShell parser errors"
    }
    else {
        $ProviderText = Get-Content -Raw $ProviderRead
        $RequiredReadShapes = @(
            '"api",',
            '"-X", "GET"',
            '"migration", "list"',
            '"--linked"',
            '"inspect", $Target',
            'remote_write = $false',
            'if (-not $Run)'
        )
        $MissingReadShapes = @(
            $RequiredReadShapes | Where-Object { $ProviderText -notmatch [regex]::Escape($_) }
        )

        if ($MissingReadShapes.Count -eq 0) {
            Add-Check "Provider read adapter" "PASS" "GitHub/Supabase/Vercel adapter is dry-run-by-default and limited to explicit read command shapes"
        }
        else {
            Add-Check "Provider read adapter" "BLOCK" ("Expected read-only adapter shape missing: " + ($MissingReadShapes -join ", "))
        }
    }
}
else {
    Add-Check "Provider read adapter" "BLOCK" "scripts/carez-provider-read.ps1 missing"
}

$Checks | Format-Table -AutoSize

$Blocks = @($Checks | Where-Object Level -eq "BLOCK")
$Warnings = @($Checks | Where-Object Level -eq "WARN")

if ($Blocks.Count -gt 0) {
    Write-Host ""
    Write-Host "CAREZ COMMAND CENTER HEALTH: BLOCKED ($($Blocks.Count) blocker(s))"
    exit 1
}

Write-Host ""
if ($Warnings.Count -gt 0) {
    Write-Host "CAREZ COMMAND CENTER HEALTH: PASS WITH $($Warnings.Count) WARNING(S)"
}
else {
    Write-Host "CAREZ COMMAND CENTER HEALTH: PASS"
}

exit 0
