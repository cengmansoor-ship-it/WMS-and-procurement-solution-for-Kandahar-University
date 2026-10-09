$ErrorActionPreference = 'Stop'

$capture = 'C:\KWMS\Backend\logs\wms-port-5000.etl'
$textLog = 'C:\KWMS\Backend\logs\wms-port-5000.txt'

& pktmon.exe stop | Out-Null
& pktmon.exe etl2txt $capture --out $textLog | Out-Null
& pktmon.exe filter remove | Out-Null

Write-Host "Capture stopped: $textLog"
