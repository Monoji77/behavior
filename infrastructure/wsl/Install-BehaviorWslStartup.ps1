$ErrorActionPreference = 'Stop'
$installDirectory = Join-Path $env:LOCALAPPDATA 'BehaviorWsl'
$startupDirectory = [Environment]::GetFolderPath('Startup')
$installedScript = Join-Path $installDirectory 'Start-BehaviorWsl.ps1'
$powershellExecutable = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Start-BehaviorWsl.ps1') -Destination $installedScript -Force

$launcherArguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $installedScript
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $startupDirectory 'Behavior WSL.lnk'))
$shortcut.TargetPath = $powershellExecutable
$shortcut.Arguments = $launcherArguments
$shortcut.WorkingDirectory = $installDirectory
$shortcut.Description = 'Keep Ubuntu and the Behavior k3s services running while signed in.'
$shortcut.WindowStyle = 7
$shortcut.Save()

Start-Process -FilePath $powershellExecutable -ArgumentList $launcherArguments -WindowStyle Hidden
Write-Output "Installed current-user login launcher: $startupDirectory\Behavior WSL.lnk"
