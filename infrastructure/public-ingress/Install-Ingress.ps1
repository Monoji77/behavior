param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('staging', 'production')]
    [string]$Environment
)

$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script in an elevated PowerShell.'
}

$source = $PSScriptRoot
$install = Join-Path $env:ProgramData 'BehaviorPublicIngress'
$downloadedCaddy = Join-Path $env:LOCALAPPDATA 'BehaviorPublicIngress\caddy.exe'
if (-not (Test-Path -LiteralPath $downloadedCaddy)) {
    throw "Caddy binary not found at $downloadedCaddy"
}
if (Get-Service -Name BehaviorPublicIngress -ErrorAction SilentlyContinue) {
    throw 'BehaviorPublicIngress already exists. Use Set-Environment.ps1 to change it.'
}

New-Item -ItemType Directory -Path $install -Force | Out-Null
$caddy = Join-Path $install 'caddy.exe'
Copy-Item -LiteralPath $downloadedCaddy -Destination $caddy
Copy-Item -LiteralPath (Join-Path $source 'Caddyfile') -Destination (Join-Path $install 'Caddyfile')
Copy-Item -LiteralPath (Join-Path $source "$Environment.env.example") -Destination (Join-Path $install 'active.env')

$config = Join-Path $install 'Caddyfile'
$envFile = Join-Path $install 'active.env'
& $caddy validate --config $config --envfile $envFile
if ($LASTEXITCODE -ne 0) { throw 'Caddy config validation failed.' }

New-NetFirewallRule -DisplayName 'Behavior public dashboard HTTP' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 -Profile Public -Program $caddy | Out-Null
New-NetFirewallRule -DisplayName 'Behavior public dashboard HTTPS' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -Profile Public -Program $caddy | Out-Null

$binaryPath = '"{0}" run --config "{1}" --envfile "{2}"' -f $caddy, $config, $envFile
New-Service -Name BehaviorPublicIngress -DisplayName 'Behavior Public Ingress' -BinaryPathName $binaryPath -StartupType Automatic | Out-Null
Start-Service BehaviorPublicIngress
Get-Service BehaviorPublicIngress
