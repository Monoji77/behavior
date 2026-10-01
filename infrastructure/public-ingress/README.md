# Direct home ingress for the dashboard

Caddy runs on the Windows host and proxies to the k3s dashboard over the
existing Tailscale link to WSL. The `Caddyfile` has one active hostname and
upstream at a time. Staging is the default; production is activated only after
the staging review.

| Environment | Hostname | Upstream |
| --- | --- | --- |
| Staging | `staging.behavior.chrisyong-portfolio.com` | `http://100.123.155.120:8092` |
| Production | `behavior.chrisyong-portfolio.com` | `http://100.123.155.120:8082` |

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
4. In Porkbun DNS, replace the parking CNAME for
   `staging.behavior.chrisyong-portfolio.com` with an `A` record pointing to
   the public WAN IPv4. Leave `behavior.chrisyong-portfolio.com` unchanged
   until production promotion. Update the A record if the ISP changes the WAN
   address, or configure dynamic DNS.

The Windows Wi-Fi network is currently classified as `Public`, so the install
script adds narrow inbound firewall rules for Caddy on TCP 80 and 443 for that
profile. Caddy uses port 80 for HTTPS certificate validation and HTTP redirects;
visitors use port 443. Public certificates are issued automatically once DNS and
router forwarding work.

## Stage

Download the official Windows Caddy binary from the
[Caddy release page](https://github.com/caddyserver/caddy/releases) and verify
its published checksum. Put `caddy.exe` at
`%LOCALAPPDATA%\BehaviorPublicIngress\caddy.exe`. Version 2.11.4 was used to
validate this config.

From an **elevated PowerShell** in this repository, after the network
prerequisites are in place:

```powershell
.\infrastructure\public-ingress\Install-Staging.ps1
```

This copies the reviewed config to `C:\ProgramData\BehaviorPublicIngress`,
creates an automatic Windows service, and allows only Caddy on inbound ports
80/443. It starts with the staging hostname and staging upstream. Check
`https://staging.behavior.chrisyong-portfolio.com/healthz` and then review the
dashboard. A normal `200` and `ok` indicate the proxy reached staging.

To inspect the service:

```powershell
Get-Service BehaviorPublicIngress
Get-NetTCPConnection -State Listen -LocalPort 80,443
```

## Promote after staging approval

Change the Porkbun `behavior` record from its parking CNAME to an `A` record
for the public WAN IPv4. Run this from an **elevated PowerShell**:

```powershell
.\infrastructure\public-ingress\Set-Environment.ps1 -Environment production
```

The script validates the config, selects the production hostname and upstream,
and restarts Caddy. Check
`https://behavior.chrisyong-portfolio.com/healthz` and then the dashboard.
The existing public Tailscale Funnel URL remains available independently.

To roll the custom domain back to staging:

```powershell
.\infrastructure\public-ingress\Set-Environment.ps1 -Environment staging
```

The app itself is unchanged by this ingress config. Both hosts serve usage data
to anyone who can reach the URL, as requested.
