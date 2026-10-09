$ErrorActionPreference = 'Stop'

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$BackendDir = Join-Path $ProjectRoot 'Backend'
$Ecosystem = Join-Path $BackendDir 'ecosystem.config.cjs'
$Pm2Home = 'C:\Users\ADMIN\.pm2'
$Pm2 = 'C:\Users\ADMIN\AppData\Roaming\npm\pm2.cmd'
$LogDir = Join-Path $BackendDir 'logs'
$LogFile = Join-Path $LogDir 'pm2-startup.log'

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-StartupLog {
  param([string]$Message)
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -Path $LogFile -Value "[$timestamp] $Message"
}

function Invoke-Pm2 {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & $Pm2 @Arguments
}

function Test-WmsOnline {
  $backend = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -eq '127.0.0.1' -or $_.LocalAddress -eq '::1' }
  $frontend = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -eq '0.0.0.0' -or $_.LocalAddress -eq '::' }
  return [bool]($backend -and $frontend)
}

function Wait-MySql {
  param([int]$TimeoutSeconds = 90)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $pending = $client.BeginConnect('127.0.0.1', 3306, $null, $null)
      if ($pending.AsyncWaitHandle.WaitOne(1000) -and $client.Connected) {
        $client.EndConnect($pending)
        return $true
      }
    } catch {
      # MySQL can still be starting during Windows boot.
    } finally {
      $client.Dispose()
    }
    Start-Sleep -Seconds 2
  }
  return $false
}

$env:PM2_HOME = $Pm2Home

Write-StartupLog 'Startup check started.'

if (-not (Test-Path $Pm2)) {
  Write-StartupLog "ERROR: PM2 command was not found at $Pm2"
  exit 1
}

Set-Location $BackendDir

if (-not (Wait-MySql)) {
  Write-StartupLog 'ERROR: MySQL did not open port 3306 within 90 seconds.'
  exit 1
}

Write-StartupLog 'MySQL is reachable.'

Write-StartupLog 'Starting or reloading WMS apps from ecosystem config.'
Invoke-Pm2 startOrReload $Ecosystem --update-env | Out-String | ForEach-Object { Write-StartupLog $_.TrimEnd() }
Start-Sleep -Seconds 5

if (-not (Test-WmsOnline)) {
  Write-StartupLog 'Apps still not online. Trying one clean restart from ecosystem config.'
  Invoke-Pm2 delete kandahar-wms-backend kandahar-wms-frontend | Out-Null
  Invoke-Pm2 start $Ecosystem --update-env | Out-String | ForEach-Object { Write-StartupLog $_.TrimEnd() }
  Start-Sleep -Seconds 5
}

if (Test-WmsOnline) {
  Invoke-Pm2 save --force | Out-String | ForEach-Object { Write-StartupLog $_.TrimEnd() }
  Write-StartupLog 'WMS apps are online and PM2 state is saved.'
  exit 0
}

Write-StartupLog 'ERROR: WMS apps are not online after startup attempts.'
exit 1
