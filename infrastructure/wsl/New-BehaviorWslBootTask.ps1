function New-BehaviorWslBootTask {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateNotNullOrEmpty()]
        [string] $UserId,

        [Parameter(Mandatory = $true)]
        [ValidateScript({
            if ([IO.Path]::GetPathRoot($_) -notmatch '^[A-Za-z]:\\$') {
                throw 'LauncherPath must be an absolute path on a local Windows drive.'
            }
            $true
        })]
        [string] $LauncherPath
    )

    $powershellExecutable = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $action = New-ScheduledTaskAction -Execute $powershellExecutable `
        -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $LauncherPath) `
        -WorkingDirectory (Split-Path -Parent $LauncherPath)
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $trigger.Delay = 'PT30S'
    $principal = New-ScheduledTaskPrincipal -UserId $UserId -LogonType Password -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
        -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)

    $task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
        -Description 'Behavior WSL unattended boot; managed by Install-BehaviorWslBootTask.ps1'
    # New-ScheduledTask may shorten a local SID to an ambiguous unqualified name.
    $task.Principal.UserId = $UserId
    $task
}
