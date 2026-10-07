# Direct home ingress for the dashboard

Caddy runs on the Windows host and proxies to the k3s dashboard over the
existing Tailscale link to WSL. The `Caddyfile` has one active hostname and
upstream at a time. The public-facing installation targets the production
hostname. Activate it after the staging review and approval.

| Environment | Hostname | Upstream |
| --- | --- | --- |
| Production | `behavior.chrisyong-portfolio.com` | `http://100.123.155.120:8082` |
| Staging (optional) | `staging.behavior.chrisyong-portfolio.com` | `http://100.123.155.120:8092` |

The upstream addresses are the WSL node's Tailscale IPv4. Windows can already
reach both `/healthz` endpoints on these ports. No Argo CD or ingestion API
route is defined here.

## Network prerequisites

1. Confirm the router's **WAN IPv4** matches the public address returned by
   `https://api.ipify.org` on this server. If the router shows a private or
   CGNAT address, direct inbound hosting requires a public IPv4 from the ISP.
2. Reserve the Windows host's current LAN address in the router's DHCP settings
   so it does not change. At preparation time it was `192.168.0.7`.
3. Forward external **TCP 80 and 443** to that Windows LAN address on the same
   ports. Do not forward 8082, 8092, 18080, Argo CD, or database ports.
4. After staging approval, replace the parking CNAME for
   `behavior.chrisyong-portfolio.com` with one `A` record pointing to the
   public WAN IPv4. Its Porkbun Host field is `behavior`. The DDNS updater
   maintains this production record.

The Windows Wi-Fi network is currently classified as `Public`, so the install
script adds narrow inbound firewall rules for Caddy on TCP 80 and 443 for that
profile. Caddy uses port 80 for HTTPS certificate validation and HTTP redirects;
visitors use port 443. Public certificates are issued automatically once DNS and
router forwarding work.

## Activate the public production host after staging approval

Download the official Windows Caddy binary from the
[Caddy release page](https://github.com/caddyserver/caddy/releases) and verify
its published checksum. Put `caddy.exe` at
`%LOCALAPPDATA%\BehaviorPublicIngress\caddy.exe`. Version 2.11.4 was used to
validate this config.

From an **elevated PowerShell** in this repository, after the network
prerequisites are in place and staging is approved:

```powershell
.\infrastructure\public-ingress\Install-Ingress.ps1 -Environment production
```

This copies the reviewed config to `C:\ProgramData\BehaviorPublicIngress`,
creates an automatic Windows service, and allows only Caddy on inbound ports
80/443. It starts with `behavior.chrisyong-portfolio.com` and the production
dashboard upstream at `http://100.123.155.120:8082`.

Enable API access for `chrisyong-portfolio.com` in Porkbun and generate an
API key scoped to that domain. In the same elevated PowerShell, run:

```powershell
.\infrastructure\public-ingress\Initialize-PorkbunDns.ps1
```

Enter the API key and secret API key at the hidden prompts. Do not paste them
into the script, repository, or chat. The script validates the keys, stores
them encrypted for this Windows machine under `C:\ProgramData`, restricts the
file to SYSTEM and Administrators, and registers `BehaviorPorkbunDDNS` to run
every five minutes as SYSTEM. It updates only the active hostname's one
existing A record when the public IPv4 changes; it never creates a record or
switches environments. To run it immediately and inspect the task:

```powershell
schtasks.exe /Run /TN BehaviorPorkbunDDNS
Get-ScheduledTaskInfo -TaskName BehaviorPorkbunDDNS
```

Check `https://behavior.chrisyong-portfolio.com/healthz` and then review the
dashboard from a connection outside the home network, such as cellular data.
A normal `200` and `ok` indicate the proxy reached production. If HTTPS fails,
confirm the router's WAN IPv4 matches Porkbun's A record and TCP 80/443 reach
the Windows machine.

To inspect the service:

```powershell
Get-Service BehaviorPublicIngress
Get-NetTCPConnection -State Listen -LocalPort 80,443
```

## Optional staging hostname

The staging environment remains available for a separate test or rollback.
To make it public, create one Porkbun `A` record with Host
`staging.behavior`, pointing to the public WAN IPv4. Install with
`-Environment staging` instead of `production`, or switch an existing
installation from an elevated PowerShell:

```powershell
.\infrastructure\public-ingress\Set-Environment.ps1 -Environment staging
```

The DDNS task always updates only the active hostname. To select the
production public host again:

```powershell
.\infrastructure\public-ingress\Set-Environment.ps1 -Environment production
```

The existing public Tailscale Funnel URL remains available independently.
The app itself is unchanged by this ingress config. Both hosts serve usage data
to anyone who can reach the URL, as requested.
