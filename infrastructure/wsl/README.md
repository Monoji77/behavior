# Keep Behavior running in WSL

Behavior already has a Cloudflare-independent public dashboard through
Tailscale Funnel: <https://behavior-dashboard.taildcd567.ts.net/>.
The Kubernetes Tailscale Ingress forwards to production's dashboard Service;
staging remains private at <https://chris.taildcd567.ts.net/>.

An enabled k3s systemd service does not keep Ubuntu running by itself.
[Microsoft documents this WSL lifecycle behavior](https://learn.microsoft.com/en-us/windows/wsl/systemd).
When the last WSL client exits, Ubuntu can shut down and take the application,
databases and tunnel connectors offline. Calling `wsl.exe` during a check
starts it again, so startup recovery can misleadingly look like steady health.

## Unattended recovery before sign-in (recommended)

The boot-task installer starts Ubuntu 30 seconds after Windows starts, under
the Windows account that owns the distribution. k3s and tailscaled must already
be enabled in Ubuntu; Kubernetes then restores the existing workloads. This
keeps both staging and production's shared host online without deploying images
or changing manifests, data, Tailscale routes, firewall rules, or DNS.

Preview from Windows PowerShell without elevation or a password:

```powershell
.\infrastructure\wsl\Install-BehaviorWslBootTask.ps1 -WhatIf
```

After reviewing the change, open **Windows PowerShell as Administrator**, using
the same Windows account that owns Ubuntu, then run from this repository:

```powershell
.\infrastructure\wsl\Install-BehaviorWslBootTask.ps1
```

Enter that Windows account's **password, not its Windows Hello PIN**, in the
local credential prompt. Do not paste it into chat or put it in the command.
The installer gives the credential to Windows Task Scheduler in memory; Windows
stores it for password logon. No password is written to a project file or
child-process command line. If the account password changes, rerun the installer.
The account also needs the Windows right to log on as a batch job.

The installer tests access to Ubuntu, k3s, and tailscaled through a temporary
scheduled task running with the same batch-logon identity. If that probe fails,
the login shortcut is preserved. After the probe succeeds, it copies the
existing keepalive script into `%LOCALAPPDATA%\BehaviorWsl`, registers and starts
`Behavior WSL Boot`, and removes the matching login shortcut. An unrelated task
or shortcut with the same name is preserved. The task runs with limited Windows
privileges, allows battery operation, has no execution time limit, and ignores
duplicate starts. The existing launcher retries WSL after five seconds if it
exits. Task Scheduler also restarts the launcher on failure.

Check the registration without starting WSL yourself:

```powershell
Get-ScheduledTask -TaskName 'Behavior WSL Boot' |
    Select-Object TaskName, State, Principal, Triggers, Settings
Get-ScheduledTaskInfo -TaskName 'Behavior WSL Boot'
wsl --list --verbose
```

The task should remain `Running`; `0x41301` means a task is currently running,
not an error. This alone does not prove application health: use the public
checks below. For the final unattended test, reboot at a convenient time,
**leave Windows at the sign-in screen**, and check the public dashboard from
another device after allowing several minutes for the cluster to recover.
Do not launch WSL manually during that test. The installer never reboots Windows.

For planned maintenance, disable and stop the boot task from elevated PowerShell
before shutting down WSL:

```powershell
Disable-ScheduledTask -TaskName 'Behavior WSL Boot'
Stop-ScheduledTask -TaskName 'Behavior WSL Boot'
```

Also stop any older login launcher still running in the current session, as
described below. To resume, use `Enable-ScheduledTask` followed by
`Start-ScheduledTask` with the same task name. To return to login-only startup,
stop the boot task, unregister it with
`Unregister-ScheduledTask -TaskName 'Behavior WSL Boot' -Confirm:$false`, then
run the login installer below without elevation.

Automatic recovery requires Windows to finish booting, the laptop to remain
awake, and a network connection. It cannot unlock a pre-boot BitLocker prompt,
turn on a powered-off laptop, or serve requests while the laptop is asleep.
The cause of random Windows restarts needs separate investigation.

## Login-only startup (fallback)

This option starts services only after signing in. Run from Windows PowerShell,
without elevation:

```powershell
.\infrastructure\wsl\Install-BehaviorWslStartup.ps1
```

The installer copies the launcher to `%LOCALAPPDATA%\BehaviorWsl`, creates
`Behavior WSL.lnk` in the current user's Startup folder, and launches it hidden.
It runs at each Windows login. A per-session mutex prevents duplicate launchers.
The launcher holds an active `wsl.exe --distribution Ubuntu --exec /bin/sleep infinity`
client open and retries after five seconds if it exits. It uses Ubuntu's default
user and does not modify Kubernetes, Tailscale routes, firewall rules, DNS,
deployed images or secrets. Both existing environments benefit from keeping
their shared host online.

This fallback is a login launcher. The computer
must stay powered on, awake and connected, and the user must remain signed in.
It cannot serve the dashboard during sleep, shutdown or loss of connectivity.

To stop it for planned WSL maintenance, use Task Manager's Details tab with the
Command line column enabled. End the `powershell.exe` process whose command line
contains `BehaviorWsl\Start-BehaviorWsl.ps1`, then end its `wsl.exe` client.
Stop the launcher before `wsl --shutdown`, otherwise it will start Ubuntu again.
To disable future login launches, delete only `Behavior WSL.lnk` from your
Startup folder (`shell:startup`).

## Verify without waking a stopped instance

Close ordinary WSL terminals, wait more than a minute, and check from Windows:

```powershell
wsl --list --verbose
curl.exe --fail https://behavior-dashboard.taildcd567.ts.net/healthz
curl.exe --fail https://behavior-dashboard.taildcd567.ts.net/api/v1/metrics/filter-options
```

Ubuntu should remain Running, `/healthz` should return `ok`, and analytics should
return HTTP 200. The public checks exercise Funnel and the application; an
internal pod status or Argo CD health snapshot alone does not prove the URL works.
At a fresh boot, allow the Java services time to become ready. Their current
liveness probes can restart them during slow startup.

## Installer tests

Use Windows PowerShell 5.1 and the Windows-provided Pester 3.4 module (Pester 3
is not compatible with PowerShell 7's error handling):

```powershell
Import-Module Pester -RequiredVersion 3.4.0
$result = Invoke-Pester -Script .\infrastructure\wsl\BootTask.Tests.ps1 -PassThru
if ($result.FailedCount -gt 0) { throw 'Boot task tests failed' }
```

Tests construct real Windows task definitions and mock installation side
effects. They do not register tasks, request real credentials, or start WSL.
