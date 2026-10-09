$ErrorActionPreference = 'Continue'

$logDir = 'C:\KWMS\Backend\logs'
$capture = Join-Path $logDir 'wms-port-5000.etl'
$statusLog = Join-Path $logDir 'wms-capture-start.txt'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$output = New-Object System.Collections.Generic.List[string]
$output.Add((& pktmon.exe stop 2>&1 | Out-String).TrimEnd())
$output.Add((& pktmon.exe filter remove 2>&1 | Out-String).TrimEnd())
$output.Add((& pktmon.exe filter add WMS5000 -t TCP -p 5000 2>&1 | Out-String).TrimEnd())
$output.Add((& pktmon.exe start --capture --comp nics --pkt-size 128 --file-name $capture --file-size 20 --log-mode circular 2>&1 | Out-String).TrimEnd())
$startExitCode = $LASTEXITCODE
$output.Add("StartExitCode=$startExitCode")
$output | Set-Content -LiteralPath $statusLog -Encoding UTF8

if ($startExitCode -ne 0) {
  exit $startExitCode
}

Write-Host "Capture started: $capture"
exit 0
