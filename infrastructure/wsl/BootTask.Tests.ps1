$ErrorActionPreference = 'Stop'
$scriptDirectory = $PSScriptRoot

Describe 'Unattended Behavior WSL boot task' {
    BeforeAll {
        . (Join-Path $scriptDirectory 'New-BehaviorWslBootTask.ps1')
        $taskUser = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $launcherPath = 'C:\Users\Example User\AppData\Local\BehaviorWsl\Start-BehaviorWsl.ps1'
        $definition = New-BehaviorWslBootTask -UserId $taskUser -LauncherPath $launcherPath
    }

    It 'starts at boot without an interactive Windows session' {
        $definition.Triggers.Count | Should Be 1
        $definition.Triggers[0].CimClass.CimClassName | Should Be 'MSFT_TaskBootTrigger'
        $definition.Triggers[0].Enabled | Should Be $true
        $definition.Principal.UserId | Should Be $taskUser
        $definition.Principal.LogonType.ToString() | Should Be 'Password'
        $definition.Principal.RunLevel.ToString() | Should Be 'Limited'
    }

    It 'keeps running on battery and beyond the default task time limit' {
        $definition.Settings.DisallowStartIfOnBatteries | Should Be $false
        $definition.Settings.StopIfGoingOnBatteries | Should Be $false
        $definition.Settings.ExecutionTimeLimit | Should Be 'PT0S'
        $definition.Settings.MultipleInstances.ToString() | Should Be 'IgnoreNew'
        $definition.Settings.StartWhenAvailable | Should Be $true
        $definition.Settings.RestartCount | Should BeGreaterThan 0
    }

    It 'launches the installed script with spaces and without a user profile' {
        $definition.Actions.Count | Should Be 1
        $definition.Actions[0].Execute | Should Be (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
        $definition.Actions[0].Arguments | Should Be ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $launcherPath)
        $definition.Actions[0].WorkingDirectory | Should Be (Split-Path -Parent $launcherPath)
    }

    It 'refuses a relative launcher path' {
        { New-BehaviorWslBootTask -UserId $taskUser -LauncherPath '.\Start-BehaviorWsl.ps1' -ErrorAction Stop } | Should Throw
    }

    It 'previews installation without elevation, credential prompts, or file changes' {
        Mock Get-Credential { throw 'Dry run requested credentials' }
        Mock Register-ScheduledTask { throw 'Dry run registered a task' }
        Mock Copy-Item { throw 'Dry run copied a file' }
        Mock Remove-Item { throw 'Dry run removed a file' }
        & (Join-Path $scriptDirectory 'Install-BehaviorWslBootTask.ps1') -WhatIf
        Assert-MockCalled Get-Credential -Times 0 -Exactly -Scope It
        Assert-MockCalled Register-ScheduledTask -Times 0 -Exactly -Scope It
        Assert-MockCalled Copy-Item -Times 0 -Exactly -Scope It
        Assert-MockCalled Remove-Item -Times 0 -Exactly -Scope It
    }
}

Describe 'Boot installer preserves the host on failure' {
    BeforeEach {
        Mock New-Object {
            $fakePrincipal = [pscustomobject]@{}
            $fakePrincipal | Add-Member -MemberType ScriptMethod -Name IsInRole -Value { $true }
            $fakePrincipal
        } -ParameterFilter { $TypeName -eq 'Security.Principal.WindowsPrincipal' }
        Mock Get-ChildItem { [pscustomobject]@{ DistributionName = 'Ubuntu' } } `
            -ParameterFilter { $LiteralPath -eq 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' }
        Mock Get-ItemProperty { [pscustomobject]@{ DistributionName = 'Ubuntu' } }
        Mock Get-Credential {
            [PSCredential]::new([Security.Principal.WindowsIdentity]::GetCurrent().Name,
                (ConvertTo-SecureString 'test-only-not-a-real-password' -AsPlainText -Force))
        }
        Mock Get-ScheduledTask { $null } -ParameterFilter { $TaskName -eq 'Behavior WSL Boot' }
        Mock Get-ScheduledTask { [pscustomobject]@{ State = 'Ready' } } `
            -ParameterFilter { $TaskName -like 'Behavior WSL Probe *' }
        Mock Get-ScheduledTaskInfo { [pscustomobject]@{ LastRunTime = Get-Date; LastTaskResult = 1 } }
        Mock Register-ScheduledTask {}
        Mock Start-ScheduledTask {}
        Mock Stop-ScheduledTask {}
        Mock Unregister-ScheduledTask {}
        Mock Start-Sleep {}
        Mock Copy-Item { throw 'Unexpected file copy' }
        Mock Remove-Item { throw 'Unexpected file removal' }
    }

    It 'keeps the login fallback and removes the temporary task when the WSL probe fails' {
        { & (Join-Path $scriptDirectory 'Install-BehaviorWslBootTask.ps1') } | Should Throw 'Scheduled WSL probe failed'
        Assert-MockCalled Register-ScheduledTask -Times 1 -Exactly -Scope It `
            -ParameterFilter { $TaskName -like 'Behavior WSL Probe *' }
        Assert-MockCalled Unregister-ScheduledTask -Times 1 -Exactly -Scope It `
            -ParameterFilter { $TaskName -like 'Behavior WSL Probe *' }
        Assert-MockCalled Register-ScheduledTask -Times 0 -Exactly -Scope It `
            -ParameterFilter { $TaskName -eq 'Behavior WSL Boot' }
        Assert-MockCalled Copy-Item -Times 0 -Exactly -Scope It
        Assert-MockCalled Remove-Item -Times 0 -Exactly -Scope It
    }

    It 'refuses a credential for another Windows account before registering anything' {
        Mock Get-Credential {
            [PSCredential]::new('NT AUTHORITY\SYSTEM',
                (ConvertTo-SecureString 'test-only-not-a-real-password' -AsPlainText -Force))
        }
        { & (Join-Path $scriptDirectory 'Install-BehaviorWslBootTask.ps1') } | Should Throw 'credential must belong'
        Assert-MockCalled Register-ScheduledTask -Times 0 -Exactly -Scope It
        Assert-MockCalled Remove-Item -Times 0 -Exactly -Scope It
    }

    It 'does not overwrite an unrelated boot task' {
        Mock Get-ScheduledTask { [pscustomobject]@{ Description = 'Another application' } } `
            -ParameterFilter { $TaskName -eq 'Behavior WSL Boot' }
        { & (Join-Path $scriptDirectory 'Install-BehaviorWslBootTask.ps1') } | Should Throw 'unrelated task'
        Assert-MockCalled Get-Credential -Times 0 -Exactly -Scope It
        Assert-MockCalled Register-ScheduledTask -Times 0 -Exactly -Scope It
    }

    It 'requires elevation before requesting the password or changing the host' {
        Mock New-Object {
            $fakePrincipal = [pscustomobject]@{}
            $fakePrincipal | Add-Member -MemberType ScriptMethod -Name IsInRole -Value { $false }
            $fakePrincipal
        } -ParameterFilter { $TypeName -eq 'Security.Principal.WindowsPrincipal' }
        { & (Join-Path $scriptDirectory 'Install-BehaviorWslBootTask.ps1') } | Should Throw 'as Administrator'
        Assert-MockCalled Get-Credential -Times 0 -Exactly -Scope It
        Assert-MockCalled Register-ScheduledTask -Times 0 -Exactly -Scope It
    }
}
