# Run from Windows so an active WSL client keeps systemd-managed k3s alive.
$ErrorActionPreference = 'Stop'
$wslExecutable = Join-Path $env:SystemRoot 'System32\wsl.exe'
$mutex = [Threading.Mutex]::new($false, 'Local\BehaviorUbuntuKeepAlive')
$ownsMutex = $false
try {
    try {
        $ownsMutex = $mutex.WaitOne(0)
    } catch [Threading.AbandonedMutexException] {
        $ownsMutex = $true
    }
    if (-not $ownsMutex) { return }

    while ($true) {
        # Use the distribution's normal user; this does not require elevation.
        & $wslExecutable --distribution Ubuntu --exec /bin/sleep infinity
        Start-Sleep -Seconds 5
    }
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
