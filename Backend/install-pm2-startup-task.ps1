$ErrorActionPreference = 'Stop'

$TaskName = 'Kandahar WMS PM2 Startup'
$ScriptPath = Join-Path $PSScriptRoot 'pm2-resurrect-or-start.ps1'
$PowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$CurrentUser = "$env:USERDOMAIN\$env:USERNAME"

if (-not (Test-Path $ScriptPath)) {
  throw "Startup script was not found: $ScriptPath"
}

$Action = New-ScheduledTaskAction `
  -Execute $PowerShell `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""

$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser

$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description 'Starts Kandahar WMS backend and frontend with PM2 when Windows user logs on.' `
  -Force | Out-Null

Write-Host "Installed scheduled task: $TaskName"
Write-Host "User: $CurrentUser"
Write-Host "Script: $ScriptPath"
