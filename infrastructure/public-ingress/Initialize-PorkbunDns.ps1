$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script in an elevated PowerShell.'
}

$install = Join-Path $env:ProgramData 'BehaviorPublicIngress'
if (-not (Test-Path -LiteralPath (Join-Path $install 'active.env'))) {
    throw 'Install staging first with Install-Staging.ps1.'
}
$sourceScript = Join-Path $PSScriptRoot 'Update-PorkbunDns.ps1'
if (-not (Test-Path -LiteralPath $sourceScript)) {
    throw 'Update-PorkbunDns.ps1 is missing.'
}

function Read-SecretText([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

$apiKey = Read-SecretText 'Porkbun API key'
$secretApiKey = Read-SecretText 'Porkbun secret API key'
if (-not $apiKey -or -not $secretApiKey) { throw 'Both Porkbun keys are required.' }

$headers = @{ 'X-API-Key' = $apiKey; 'X-Secret-API-Key' = $secretApiKey }
$ping = Invoke-RestMethod -Uri 'https://api.porkbun.com/api/json/v3/ping' -Headers $headers -TimeoutSec 15
if ($ping.status -ne 'SUCCESS' -or $ping.credentialsValid -ne $true) {
    throw 'Porkbun did not validate the API keys.'
}

$json = @{ apiKey = $apiKey; secretApiKey = $secretApiKey } | ConvertTo-Json -Compress
$bytes = [Text.Encoding]::UTF8.GetBytes($json)
try {
    $encrypted = [Security.Cryptography.ProtectedData]::Protect(
        $bytes, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine
    )
} finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
    $apiKey = $null
    $secretApiKey = $null
    $json = $null
}

$secretFile = Join-Path $install 'porkbun-credentials.bin'
[IO.File]::WriteAllBytes($secretFile, $encrypted)
$acl = Get-Acl -LiteralPath $secretFile
$acl.SetAccessRuleProtection($true, $false)
foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleAll($rule) }
foreach ($sidText in @('S-1-5-18', 'S-1-5-32-544')) {
    $sid = [Security.Principal.SecurityIdentifier]::new($sidText)
    $rule = [Security.AccessControl.FileSystemAccessRule]::new(
        $sid, [Security.AccessControl.FileSystemRights]::FullControl,
        [Security.AccessControl.AccessControlType]::Allow
    )
    $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $secretFile -AclObject $acl

$script = Join-Path $install 'Update-PorkbunDns.ps1'
Copy-Item -LiteralPath $sourceScript -Destination $script -Force
& powershell.exe -NoProfile -NonInteractive -File $script -DryRun
if ($LASTEXITCODE -ne 0) { throw 'DDNS dry run failed. Check the Porkbun A record and domain API access.' }
$taskCommand = "powershell.exe -NoProfile -NonInteractive -File `"$script`""
& schtasks.exe /Create /F /TN 'BehaviorPorkbunDDNS' /SC MINUTE /MO 5 /RU SYSTEM /TR $taskCommand | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not create the DDNS scheduled task.' }
Write-Output 'Porkbun credentials stored for this machine; DDNS task runs every 5 minutes.'
