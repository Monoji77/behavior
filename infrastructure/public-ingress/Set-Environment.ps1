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

$install = Join-Path $env:ProgramData 'BehaviorPublicIngress'
$config = Join-Path $install 'Caddyfile'
$envFile = Join-Path $install 'active.env'
$caddy = Join-Path $install 'caddy.exe'
$selected = Join-Path $PSScriptRoot "$Environment.env.example"
if (-not (Get-Service -Name BehaviorPublicIngress -ErrorAction SilentlyContinue)) {
    throw 'Install ingress first with Install-Ingress.ps1.'
}

$previous = Get-Content -LiteralPath $envFile -Raw
try {
    Copy-Item -LiteralPath $selected -Destination $envFile -Force
    try {
        $ErrorActionPreference = 'Continue'
        & $caddy validate --config $config --envfile $envFile 2>&1 | ForEach-Object { $_.ToString() }
        $validationExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = 'Stop'
    }
    if ($validationExitCode -ne 0) { throw 'Caddy config validation failed.' }
    Restart-Service BehaviorPublicIngress
} catch {
    Set-Content -LiteralPath $envFile -Value $previous -NoNewline
    Restart-Service BehaviorPublicIngress -ErrorAction SilentlyContinue
    throw
}
Get-Service BehaviorPublicIngress
