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

After reviewing this host change, run from Windows PowerShell, without elevation:

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

This is a login launcher, not an unattended Windows boot service. The computer
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
