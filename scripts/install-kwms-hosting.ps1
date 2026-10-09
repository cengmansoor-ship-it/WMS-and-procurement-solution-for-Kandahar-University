$ErrorActionPreference = 'Stop'

$taskName = 'Kandahar WMS PM2 Restore'
$firewallRuleName = 'Kandahar WMS Web 5000'
$startupScript = 'C:\KWMS\Backend\pm2-resurrect-or-start.ps1'
$powerShell = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this script from PowerShell as Administrator.'
}

if (-not (Test-Path -LiteralPath $startupScript)) {
  throw "Startup script was not found: $startupScript"
}

$firewallRule = Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue
if ($firewallRule) {
  $firewallRule | Set-NetFirewallRule -Enabled True -Direction Inbound -Action Allow -Profile Any
  $firewallRule | Get-NetFirewallPortFilter | Set-NetFirewallPortFilter -Protocol TCP -LocalPort 5000
} else {
  New-NetFirewallRule `
    -DisplayName $firewallRuleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 5000 `
    -Profile Any `
    -RemoteAddress LocalSubnet | Out-Null
}

$taskAction = New-ScheduledTaskAction `
  -Execute $powerShell `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startupScript`"" `
  -WorkingDirectory 'C:\KWMS'
$taskTrigger = New-ScheduledTaskTrigger -AtStartup
$taskTrigger.Delay = 'PT30S'
$taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $taskAction `
  -Trigger $taskTrigger `
  -Principal $taskPrincipal `
  -Settings $taskSettings `
  -Description 'Starts and verifies Kandahar WMS after Windows boots.' `
  -Force | Out-Null

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 10

$taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
$frontend = Get-NetTCPConnection -State Listen -LocalPort 5000 -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalAddress -eq '0.0.0.0' -or $_.LocalAddress -eq '::' }
$health = Invoke-WebRequest -Uri 'http://127.0.0.1:5000/api/health' -UseBasicParsing -TimeoutSec 15

if (-not $frontend -or $health.StatusCode -ne 200) {
  throw 'Hosting verification failed after installing the startup task.'
}

Write-Host "Task=$taskName LastResult=$($taskInfo.LastTaskResult)"
Write-Host "Frontend=0.0.0.0:5000 Health=$($health.StatusCode)"
