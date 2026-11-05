# OpenTunnel Windows Network Engine Helper Scripts
# Automates Windows Filtering Platform (WFP), Wintun routing, and NRPT DNS leak policies.

function Enable-OpenTunnelKillSwitch {
    param (
        [string]$VpnServerIp,
        [int]$VpnServerPort
    )
    Write-Host "[WFP] Arming Windows Filtering Platform kill-switch filters..."
    # 1. Allow local loopback
    New-NetFirewallRule -DisplayName "OpenTunnel-Allow-Loopback" -Direction Outbound -Action Allow -RemoteAddress "127.0.0.1/8", "::1" -Enabled True | Out-Null
    
    # 2. Allow outbound connection exclusively to the designated VPN server endpoint
    New-NetFirewallRule -DisplayName "OpenTunnel-Allow-VpnEndpoint" -Direction Outbound -Action Allow -RemoteAddress $VpnServerIp -RemotePort $VpnServerPort -Protocol TCP,UDP -Enabled True | Out-Null
    
    # 3. Allow outbound traffic through the virtual Wintun interface (OpenTunnel0)
    New-NetFirewallRule -DisplayName "OpenTunnel-Allow-VirtualInterface" -Direction Outbound -Action Allow -InterfaceAlias "OpenTunnel0" -Enabled True | Out-Null
    
    # 4. Block general outbound traffic to prevent unencrypted leaks
    New-NetFirewallRule -DisplayName "OpenTunnel-Block-All-Leaks" -Direction Outbound -Action Block -Enabled True | Out-Null
    Write-Host "[WFP] Kill switch filters actively enforced."
}

function Disable-OpenTunnelKillSwitch {
    Write-Host "[WFP] Disarming Windows Filtering Platform kill-switch filters..."
    Remove-NetFirewallRule -DisplayName "OpenTunnel-*" -ErrorAction SilentlyContinue | Out-Null
    Write-Host "[WFP] Kill switch disarmed. Normal network traffic restored."
}

function Enable-OpenTunnelDnsProtection {
    param (
        [string]$TunnelDnsServer = "1.1.1.1"
    )
    Write-Host "[NRPT] Enforcing Name Resolution Policy Table (NRPT) wildcard rule for DNS leak prevention..."
    # Configures NRPT rule binding all DNS requests to the encrypted tunnel resolver
    Add-DnsClientNrptRule -Namespace "." -DnsServers $TunnelDnsServer | Out-Null
    Write-Host "[NRPT] Wildcard namespace successfully bound to $TunnelDnsServer."
}

function Disable-OpenTunnelDnsProtection {
    Write-Host "[NRPT] Clearing OpenTunnel NRPT DNS leak rules..."
    Get-DnsClientNrptRule | Where-Object { $_.Namespace -eq "." } | Remove-DnsClientNrptRule -Force -ErrorAction SilentlyContinue | Out-Null
    Write-Host "[NRPT] NRPT rules cleared."
}

