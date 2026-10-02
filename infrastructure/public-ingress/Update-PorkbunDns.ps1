param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$install = Join-Path $env:ProgramData 'BehaviorPublicIngress'
$envFile = Join-Path $install 'active.env'
$secretFile = Join-Path $install 'porkbun-credentials.bin'

if (-not (Test-Path -LiteralPath $envFile)) { throw 'Ingress is not installed.' }
if (-not (Test-Path -LiteralPath $secretFile)) { throw 'Porkbun credentials are not configured.' }

$hostLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^BEHAVIOR_DOMAIN=' } | Select-Object -First 1
$hostName = ($hostLine -replace '^BEHAVIOR_DOMAIN=', '').Trim()
$allowedHosts = @('staging.behavior.chrisyong-portfolio.com', 'behavior.chrisyong-portfolio.com')
if ($hostName -notin $allowedHosts) { throw "Unexpected active hostname: $hostName" }
$subdomain = $hostName.Substring(0, $hostName.Length - '.chrisyong-portfolio.com'.Length)

$encrypted = [IO.File]::ReadAllBytes($secretFile)
$plain = [Security.Cryptography.ProtectedData]::Unprotect(
    $encrypted, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine
)
try {
    $credentials = [Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json
} finally {
    [Array]::Clear($plain, 0, $plain.Length)
}
$headers = @{
    'X-API-Key' = $credentials.apiKey
    'X-Secret-API-Key' = $credentials.secretApiKey
    'Accept' = 'application/json'
}

# Porkbun reports the caller's public IPv4, avoiding a separate IP service.
$publicIp = Invoke-RestMethod -Uri 'https://api-ipv4.porkbun.com/api/json/v3/ip' -Headers $headers -TimeoutSec 15
$ip = $null
if ($publicIp.status -ne 'SUCCESS' -or
    -not [Net.IPAddress]::TryParse([string]$publicIp.yourIp, [ref]$ip) -or
    $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) {
    throw 'Porkbun did not return a valid public IPv4 address.'
}
$octets = $ip.GetAddressBytes()
if ($octets[0] -eq 0 -or $octets[0] -eq 10 -or $octets[0] -eq 127 -or
    $octets[0] -ge 224 -or ($octets[0] -eq 169 -and $octets[1] -eq 254) -or
    ($octets[0] -eq 172 -and $octets[1] -ge 16 -and $octets[1] -le 31) -or
    ($octets[0] -eq 192 -and $octets[1] -eq 168) -or
    ($octets[0] -eq 100 -and $octets[1] -ge 64 -and $octets[1] -le 127)) {
    throw 'Porkbun returned a private or reserved IPv4 address.'
}

$recordUrl = "https://api.porkbun.com/api/json/v3/dns/retrieveByNameType/chrisyong-portfolio.com/A/$subdomain"
$records = Invoke-RestMethod -Uri $recordUrl -Headers $headers -TimeoutSec 15
if ($records.status -ne 'SUCCESS' -or -not $records.records -or @($records.records).Count -ne 1) {
    throw "Expected exactly one existing A record for $hostName. Create it in Porkbun first."
}
$currentIp = [string]@($records.records)[0].content
if ($currentIp -eq $ip.ToString()) {
    Write-Output "$hostName is current ($currentIp)."
    exit 0
}
if ($DryRun) {
    Write-Output "Would change $hostName from $currentIp to $ip."
    exit 0
}

$editUrl = "https://api.porkbun.com/api/json/v3/dns/editByNameType/chrisyong-portfolio.com/A/$subdomain"
$body = @{ content = $ip.ToString(); ttl = 600 } | ConvertTo-Json -Compress
$result = Invoke-RestMethod -Uri $editUrl -Method Post -Headers $headers -Body $body -ContentType 'application/json' -TimeoutSec 15
if ($result.status -ne 'SUCCESS') { throw "Porkbun rejected the A record update for $hostName." }
if ($result.warnings) { throw "Porkbun stored the update with warnings: $($result.warnings -join '; ')" }
Write-Output "Updated $hostName from $currentIp to $ip."
