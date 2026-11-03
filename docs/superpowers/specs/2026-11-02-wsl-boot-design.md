# Unattended WSL startup

The user approved recovery before Windows sign-in. Behavior's existing k3s
and tailscaled systemd services are enabled, but Ubuntu is stopped after a
Windows reboot until a WSL client starts. The current Startup shortcut only
runs after login.

## Approach

Use a Windows Task Scheduler boot trigger, running with password logon as
the Windows user who owns Ubuntu. Keep the existing long-running WSL client
and retry loop. Install the script outside OneDrive and outside the checkout.
Task settings permit battery operation, have no execution time limit, and
ignore duplicate starts. A temporary scheduled WSL probe must succeed under
the same account before installing the persistent task and retiring the
login shortcut. Only a shortcut pointing to this project's installed script
may be removed.

The alternative, keeping the login shortcut, cannot recover before sign-in.
Running as SYSTEM would not use the user's WSL registration. Migrating to
another machine is outside this change.

## Constraints and acceptance

- One PR; no merge, approval, or application promotion.
- Administrator rights and a locally entered Windows account password are
  needed for activation. Never put credentials in files or process arguments.
- Refuse a credential for a different Windows identity.
- Preserve the login fallback if the probe or task registration fails.
- An interrupted WSL client is retried by the existing launcher.
- Verify task policy with Windows PowerShell tests. Verify registration and
  execution on the host when the user completes the local Windows prompts.
- Reboot-before-sign-in verification requires a deliberate later reboot;
  do not reboot the laptop during this work.
- No Kubernetes manifests, images, database content, or Tailscale route changes.

This restores availability after Windows boots; it does not turn on a
powered-off machine, unlock BitLocker, prevent sleep, or diagnose random reboots.
