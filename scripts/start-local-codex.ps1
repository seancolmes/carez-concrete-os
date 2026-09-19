[CmdletBinding()]
param(
    [string]$WebUiDir = $env:CAREZ_CODEX_WEBUI_DIR,
    [int]$WebUiPort = 3001
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($WebUiDir)) {
    $WebUiDir = Join-Path $HOME "Documents\Development\codex-webui"
}

$codexHome = Join-Path $HOME ".codex-omniroute"
$configPath = Join-Path $codexHome "config.toml"

function Test-TcpPort {
    param([int]$Port)

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(500, $false)) { return $false }
        $client.EndConnect($async)
        return $client.Connected
    }
    catch { return $false }
    finally { $client.Close() }
}

function Wait-TcpPort {
    param([int]$Port, [int]$TimeoutSeconds = 60)
    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        if (Test-TcpPort -Port $Port) { return $true }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Start-BackgroundPowerShell {
    param([string]$WorkingDirectory, [string]$Command)
    Start-Process -FilePath "powershell.exe" -WorkingDirectory $WorkingDirectory -WindowStyle Minimized -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        $Command
    ) | Out-Null
}

if (-not (Test-Path $configPath)) { throw "Missing Carez Codex config: $configPath" }

$config = [System.IO.File]::ReadAllText($configPath)
if ($config -notmatch 'model_provider\s*=\s*"omniroute"') {
    throw 'Carez Codex config is not using model_provider = "omniroute".'
}
if ($config -notmatch 'base_url\s*=\s*"http://127\.0\.0\.1:20128/v1"') {
    throw "Carez Codex config is not pointed at local OmniRoute on 127.0.0.1:20128."
}

$apiKey = [Environment]::GetEnvironmentVariable("OMNIROUTE_API_KEY", "User")
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw "OMNIROUTE_API_KEY is missing from the Windows User environment."
}

if (-not (Test-Path $WebUiDir)) { throw "Codex Web UI directory not found: $WebUiDir" }

if (-not (Test-TcpPort -Port 11434)) {
    Start-BackgroundPowerShell -WorkingDirectory $HOME -Command "ollama serve"
    if (-not (Wait-TcpPort -Port 11434 -TimeoutSeconds 30)) { throw "Ollama did not start on port 11434." }
}

if (-not (Test-TcpPort -Port 20128)) {
    Start-BackgroundPowerShell -WorkingDirectory $HOME -Command "omniroute"
    if (-not (Wait-TcpPort -Port 20128 -TimeoutSeconds 60)) { throw "OmniRoute did not start on port 20128." }
}

if (-not (Test-TcpPort -Port $WebUiPort)) {
    $buildId = Join-Path $WebUiDir ".next\BUILD_ID"
    if (-not (Test-Path $buildId)) {
        throw "Codex Web UI is not built. Run npm install and npm run build once in $WebUiDir."
    }

    $webCommand = @'
$env:CODEX_HOME = Join-Path $HOME ".codex-omniroute"
$env:OMNIROUTE_API_KEY = [Environment]::GetEnvironmentVariable("OMNIROUTE_API_KEY", "User")
Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:OPENAI_ORG_ID -ErrorAction SilentlyContinue
Remove-Item Env:OPENAI_PROJECT_ID -ErrorAction SilentlyContinue
'@
    $webCommand += "`r`n`$env:PORT = '$WebUiPort'`r`nnpm start"

    Start-BackgroundPowerShell -WorkingDirectory $WebUiDir -Command $webCommand
    if (-not (Wait-TcpPort -Port $WebUiPort -TimeoutSeconds 60)) {
        throw "Codex Web UI did not start on port $WebUiPort."
    }
}

Start-Process "http://127.0.0.1:$WebUiPort"
