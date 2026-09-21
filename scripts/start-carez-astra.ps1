[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CodexArgs
)

$ErrorActionPreference = "Stop"

$PreviousHookOverride = [Environment]::GetEnvironmentVariable("IMPECCABLE_HOOK_DISABLED", "Process")
$env:IMPECCABLE_HOOK_DISABLED = "1"

try {
    & codex --profile carez-astra @CodexArgs
    exit $LASTEXITCODE
}
finally {
    if ($null -eq $PreviousHookOverride) {
        Remove-Item Env:IMPECCABLE_HOOK_DISABLED -ErrorAction SilentlyContinue
    }
    else {
        $env:IMPECCABLE_HOOK_DISABLED = $PreviousHookOverride
    }
}
