$ErrorActionPreference = 'Continue'

$outputPath = 'C:\KWMS\Backend\logs\lan-diagnostics.txt'
$lines = New-Object System.Collections.Generic.List[string]

function Add-Section {
  param([string]$Title, [scriptblock]$Command)
  $lines.Add("`r`n===== $Title =====")
  try {
    $result = & $Command | Out-String -Width 240
    $lines.Add($result.TrimEnd())
  } catch {
    $lines.Add("ERROR: $($_.Exception.Message)")
  }
}

Add-Section 'TIME AND IDENTITY' {
  Get-Date
  whoami.exe /all
}

Add-Section 'NETWORK CONFIGURATION' {
  Get-NetConnectionProfile
  Get-NetIPConfiguration -InterfaceAlias 'Ethernet'
  Get-NetIPInterface -InterfaceAlias 'Ethernet' -AddressFamily IPv4
  Get-NetIPAddress -InterfaceAlias 'Ethernet' -AddressFamily IPv4
}

Add-Section 'LISTENERS' {
  Get-NetTCPConnection -State Listen -LocalPort 5000,3001 |
    Select-Object LocalAddress, LocalPort, OwningProcess
}

Add-Section 'FIREWALL PROFILES' {
  Get-NetFirewallProfile -PolicyStore ActiveStore |
    Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction, AllowInboundRules, AllowLocalFirewallRules, AllowLocalIPsecRules
}

Add-Section 'EFFECTIVE WMS FIREWALL RULES' {
  Get-NetFirewallRule -PolicyStore ActiveStore |
    Where-Object { $_.DisplayName -like '*Kandahar WMS*' } |
    ForEach-Object {
      $rule = $_
      $ports = $rule | Get-NetFirewallPortFilter
      $addresses = $rule | Get-NetFirewallAddressFilter
      [pscustomobject]@{
        DisplayName = $rule.DisplayName
        Enabled = $rule.Enabled
        Profile = $rule.Profile
        Direction = $rule.Direction
        Action = $rule.Action
        Protocol = $ports.Protocol
        LocalPort = $ports.LocalPort
        LocalAddress = $addresses.LocalAddress
        RemoteAddress = $addresses.RemoteAddress
        PolicyStoreSourceType = $rule.PolicyStoreSourceType
      }
    } | Format-List
}

Add-Section 'FIREWALL LOCAL POLICY MERGE' {
  Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\WindowsFirewall\DomainProfile' -ErrorAction SilentlyContinue
  Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\WindowsFirewall\PrivateProfile' -ErrorAction SilentlyContinue
  Get-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\WindowsFirewall\PublicProfile' -ErrorAction SilentlyContinue
}

Add-Section 'SECURITY PRODUCTS' {
  Get-CimInstance -Namespace root\SecurityCenter2 -ClassName FirewallProduct -ErrorAction SilentlyContinue |
    Select-Object displayName, pathToSignedProductExe, productState
  Get-CimInstance -Namespace root\SecurityCenter2 -ClassName AntivirusProduct -ErrorAction SilentlyContinue |
    Select-Object displayName, pathToSignedProductExe, productState
}

Add-Section 'ROUTES' {
  Get-NetRoute -AddressFamily IPv4 |
    Sort-Object RouteMetric, DestinationPrefix |
    Select-Object InterfaceAlias, DestinationPrefix, NextHop, RouteMetric, State
}

Add-Section 'DNS' {
  Get-DnsClientServerAddress -InterfaceAlias 'Ethernet' -AddressFamily IPv4
  Resolve-DnsName warehouse.com
}

$lines | Set-Content -LiteralPath $outputPath -Encoding UTF8
Write-Host $outputPath
