$ErrorActionPreference = 'Stop'

$firewallRuleName = 'Kandahar WMS Frontend TCP 5000'
$taskName = 'Kandahar WMS PM2 Restore'
$startupScript = 'C:\KWMS\Backend\pm2-resurrect-or-start.ps1'

try {
  $existingFirewallRule = Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue
  if ($existingFirewallRule) {
    Set-NetFirewallRule -DisplayName $firewallRuleName -Enabled True -Direction Inbound -Action Allow -Profile Any
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
    -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' `
    -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startupScript`"" `
    -WorkingDirectory 'C:\KWMS'
  $taskTrigger = New-ScheduledTaskTrigger -AtStartup
  $taskTrigger.Delay = 'PT30S'
  $taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $taskSettings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

  Register-ScheduledTask `
    -TaskName $taskName `
    -Action $taskAction `
    -Trigger $taskTrigger `
    -Principal $taskPrincipal `
    -Settings $taskSettings `
    -Description 'Restores Kandahar WMS frontend and backend through PM2 after Windows starts.' `
    -Force | Out-Null

  exit 0
} catch {
  Write-Error $_
  exit 1
}
