# Run in Windows PowerShell as Administrator, using the account that owns Ubuntu.
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'New-BehaviorWslBootTask.ps1')
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$taskName = 'Behavior WSL Boot'
$installDirectory = Join-Path $env:LOCALAPPDATA 'BehaviorWsl'
$installedScript = Join-Path $installDirectory 'Start-BehaviorWsl.ps1'
$definition = New-BehaviorWslBootTask -UserId $identity.User.Value -LauncherPath $installedScript

# Preview must not prompt for credentials, require elevation, or change the host.
if (-not $PSCmdlet.ShouldProcess($identity.Name, "Install '$taskName' to start Ubuntu before sign-in")) {
    return
}

$principal = New-Object -TypeName Security.Principal.WindowsPrincipal -ArgumentList $identity
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Open Windows PowerShell as Administrator under the Ubuntu owner account, then rerun this installer.'
}
$distributions = @(Get-ChildItem -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' |
    Get-ItemProperty | Where-Object { $_.DistributionName -eq 'Ubuntu' })
if ($distributions.Count -ne 1) {
    throw 'This Windows account does not own a registered Ubuntu distribution. Run as its owner.'
}
$existingTask = Get-ScheduledTask -TaskName $taskName -TaskPath '\' -ErrorAction SilentlyContinue
if ($existingTask) {
    if ($existingTask.Description -ne $definition.Description) {
        throw "An unrelated task named '$taskName' already exists; it has been left untouched."
    }
    $existingUser = $existingTask.Principal.UserId
    if ($existingUser -match '^S-1-') {
        $existingTaskSid = [Security.Principal.SecurityIdentifier]::new($existingUser)
    } else {
        if ($existingUser -notmatch '[\\@]') { $existingUser = $env:COMPUTERNAME + '\' + $existingUser }
        $existingTaskSid = [Security.Principal.NTAccount]::new($existingUser).Translate([Security.Principal.SecurityIdentifier])
    }
    if ($existingTaskSid.Value -ne $identity.User.Value) {
        throw "An unrelated task named '$taskName' already exists; it has been left untouched."
    }
}

$credential = Get-Credential -UserName $identity.Name `
    -Message 'Enter your Windows account PASSWORD (not your PIN). Task Scheduler uses it to start Ubuntu before sign-in.'
if (-not $credential -or $credential.Password.Length -eq 0) {
    throw 'A Windows account password is required for unattended startup.'
}
$credentialSid = [Security.Principal.NTAccount]::new($credential.UserName).Translate(
    [Security.Principal.SecurityIdentifier])
if ($credentialSid.Value -ne $identity.User.Value) {
    throw 'The credential must belong to the current Windows account that owns Ubuntu.'
}

# Test WSL in an actual batch-logon session before changing the login fallback.
# The password is passed in memory to Task Scheduler, never to a child command or file.
$probeName = 'Behavior WSL Probe ' + [Guid]::NewGuid().ToString('N')
$probeRegistered = $false
try {
    $probeAction = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\wsl.exe') `
        -Argument '--distribution Ubuntu --user root --exec /bin/sh -c "systemctl is-enabled --quiet k3s && systemctl is-enabled --quiet tailscaled"'
    $probeSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
    $probe = New-ScheduledTask -Action $probeAction -Principal $definition.Principal -Settings $probeSettings
    Register-ScheduledTask -TaskName $probeName -TaskPath '\' -InputObject $probe `
        -User $credential.UserName -Password $credential.GetNetworkCredential().Password | Out-Null
    $probeRegistered = $true
    $requestedAfter = (Get-Date).AddSeconds(-1)
    Start-ScheduledTask -TaskName $probeName -TaskPath '\'
    $deadline = (Get-Date).AddMinutes(2)
    do {
        Start-Sleep -Seconds 1
        $probeState = (Get-ScheduledTask -TaskName $probeName -TaskPath '\').State
        $probeInfo = Get-ScheduledTaskInfo -TaskName $probeName -TaskPath '\'
        $probeCompleted = $probeInfo.LastRunTime -ge $requestedAfter -and
            $probeState -notin @('Running', 'Queued')
    } until ($probeCompleted -or (Get-Date) -ge $deadline)
    if (-not $probeCompleted -or $probeInfo.LastTaskResult -ne 0) {
        throw ('Scheduled WSL probe failed (result 0x{0:X8}). Check the account password, batch-logon rights, and that k3s and tailscaled are enabled. The login shortcut has been preserved.' -f $probeInfo.LastTaskResult)
    }

    New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Start-BehaviorWsl.ps1') -Destination $installedScript -Force
    Register-ScheduledTask -TaskName $taskName -TaskPath '\' -InputObject $definition `
        -User $credential.UserName -Password $credential.GetNetworkCredential().Password -Force | Out-Null
    Start-ScheduledTask -TaskName $taskName -TaskPath '\'
    Start-Sleep -Seconds 5
    if ((Get-ScheduledTask -TaskName $taskName -TaskPath '\').State -ne 'Running') {
        throw 'Boot task did not stay running. The login shortcut has been preserved; inspect Task Scheduler.'
    }

    $shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'Behavior WSL.lnk'
    if (Test-Path -LiteralPath $shortcutPath) {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        if ($shortcut.TargetPath -eq $definition.Actions[0].Execute -and
                $shortcut.Arguments -eq $definition.Actions[0].Arguments) {
            Remove-Item -LiteralPath $shortcutPath -Force
        } else {
            Write-Warning 'The existing Behavior WSL shortcut has a different target and has been preserved.'
        }
    }
    Write-Output "Installed and started '$taskName' for $($identity.Name). Ubuntu will start 30 seconds after Windows boots, before sign-in."
    Write-Output 'A later reboot without signing in is still required to verify unattended recovery.'
} finally {
    $credential = $null
    if ($probeRegistered) {
        Stop-ScheduledTask -TaskName $probeName -TaskPath '\' -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $probeName -TaskPath '\' -Confirm:$false
    }
}
