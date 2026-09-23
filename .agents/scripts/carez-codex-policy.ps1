$ErrorActionPreference = "Stop"

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

try {
    $event = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$eventName = [string]$event.hook_event_name

if ($eventName -eq "SessionStart") {
    $cwd = [string]$event.cwd
    if ([string]::IsNullOrWhiteSpace($cwd)) { exit 0 }

    $branch = (& git -C $cwd branch --show-current 2>$null | Select-Object -First 1)
    if ($LASTEXITCODE -ne 0) { exit 0 }

    $status = @(& git -C $cwd status --porcelain 2>$null)
    $messages = @()

    if ($branch -ne "staging") {
        $messages += "Carez normal branch is staging; current branch is '$branch'. Do not change branches or edit unless the task explicitly authorizes this branch."
    }

    if ($status.Count -gt 0) {
        $messages += "Carez working tree already has $($status.Count) changed path(s). Preserve pre-existing work; do not reset, stash, restore, clean, or overwrite it."
    }

    if ($messages.Count -gt 0) {
        $out = @{
            hookSpecificOutput = @{
                hookEventName = "SessionStart"
                additionalContext = ($messages -join " ")
            }
        }
        $out | ConvertTo-Json -Compress -Depth 5
    }
    exit 0
}

if ($eventName -ne "PreToolUse") { exit 0 }
if ([string]$event.tool_name -ne "Bash") { exit 0 }

$commandValue = $event.tool_input.command
if ($null -eq $commandValue) { exit 0 }

if ($commandValue -is [System.Array]) {
    $commandText = ($commandValue -join " ")
} else {
    $commandText = [string]$commandValue
}

# Codex on Windows may invoke shell text through powershell.exe -Command.
# Evaluate the inner script when that wrapper is present so policy still applies.
$policyText = $commandText
$marker = $commandText.IndexOf("-Command", [System.StringComparison]::OrdinalIgnoreCase)
if ($marker -ge 0) {
    $policyText = $commandText.Substring($marker + 8).Trim()
    if ($policyText.Length -ge 2) {
        $first = $policyText.Substring(0, 1)
        $last = $policyText.Substring($policyText.Length - 1, 1)
        if (($first -eq "'" -and $last -eq "'") -or ($first -eq '"' -and $last -eq '"')) {
            $policyText = $policyText.Substring(1, $policyText.Length - 2)
        }
    }
}

$blocked = @(
    @{
        Pattern = '(?i)(^|[;&|]\s*)git\s+(add|commit|push|pull|merge|rebase|reset|clean|checkout|switch|stash|restore|cherry-pick|revert|rm)\b'
        Reason = 'Carez Git publication/history/staging/discard operations are human-controlled. Use read-only Git commands and GitHub Desktop.'
    },
    @{
        Pattern = '(?i)(^|[;&|]\s*)git\s+branch\s+(-d|-D|-m|-M)\b'
        Reason = 'Carez branch deletion or rename is a deliberate human operation.'
    },
    @{
        Pattern = '(?i)(^|[;&|]\s*)git\s+worktree\s+(add|remove|move|lock|unlock|prune|repair)\b'
        Reason = 'Carez worktree lifecycle is managed through ChatGPT Desktop Worktree/Handoff controls or explicit human maintenance.'
    },
    @{
        Pattern = '(?i)(^|[;&|]\s*)supabase\s+migration\s+repair\b'
        Reason = 'Supabase migration-history repair requires the explicit Carez recovery procedure and human control.'
    },
    @{
        Pattern = '(?i)(^|[;&|]\s*)(npm|pnpm)\s+publish\b'
        Reason = 'Carez is not published from local Codex.'
    }
)

foreach ($rule in $blocked) {
    if ($policyText -match $rule.Pattern) {
        $out = @{
            hookSpecificOutput = @{
                hookEventName = "PreToolUse"
                permissionDecision = "deny"
                permissionDecisionReason = $rule.Reason
            }
        }
        $out | ConvertTo-Json -Compress -Depth 5
        exit 0
    }
}

exit 0
