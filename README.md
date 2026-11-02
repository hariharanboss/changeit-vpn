# OpenTunnel Desktop

An open-source, modular, and secure Windows desktop VPN application built with React, TypeScript, Tailwind CSS, Wintun, and Windows network primitives (WFP and NRPT).

---

## 1. Problem & Context

Standard consumer VPN protocols (such as stock WireGuard over UDP 51820 or OpenVPN UDP) commonly fail on restrictive institutional or enterprise networks (e.g. FortiGate, Palo Alto, Cisco Firepower firewalls) because:
1. **Outbound UDP Starvation**: The network blocks all non-TCP traffic.
2. **Deep Packet Inspection (DPI)**: The firewall identifies standard VPN handshake signatures (WireGuard 148-byte initiation or OpenVPN TLS headers) and drops them.
3. **DNS Interception**: Outbound port 53 is sinkholed or redirected to the local gateway.

Apps like JumpJumpVPN on mobile operate by wrapping user traffic into an obfuscated TCP/TLS 443 stream over Android's `VpnService`. **OpenTunnel Desktop** provides a clean, open, and audit-friendly desktop architecture for Windows.

---

## 2. Key Features

- **Multi-Protocol Engine**:
  - **WireGuard**: High-performance, ultra-low latency via the memory-mapped `Wintun` Layer 3 driver.
  - **Stealth-TLS & OpenVPN-TCP (Port 443)**: Bypasses UDP-restricted networks by encapsulating data in standard HTTPS-style TLS connections.
- **Fail-Safe Kill Switch**: Built directly with the **Windows Filtering Platform (WFP)** API to eliminate leaks during drops or renegotiations.
- **DNS Leak Protection**: Leverages the Windows **Name Resolution Policy Table (NRPT)** to force all resolution (`.`) through the secure tunnel resolver.
- **Real-Time Diagnostics**: Integrated network probe to evaluate gateway UDP reachability, DNS interception, and DPI detection.
- **Modern Responsive UI**: Dark-themed cyberpunk dashboard showing real-time throughput, latency graphs, and server selection.

---

## 3. Getting Started

### Prerequisites
- Node.js (v18+)
- Windows 10/11 x64

### Quick Start
```bash
# Clone the repository
git clone https://github.com/your-username/opentunnel-desktop.git
cd opentunnel-desktop

# Install dependencies
npm install

# Run the desktop development environment
npm run dev
```

### Windows Network Integration Scripts
Privileged Windows network rules (WFP kill switch and NRPT DNS tables) are located in:
```powershell
# Open with PowerShell Administrator:
.\scripts\windows-engine.ps1
```

---

## 4. Architecture Reference
See the comprehensive specification in `OpenTunnel_Architecture_Specification.md` for full comparison tables, packet flow diagrams, and threat modeling.

---

## 5. License
Dual-licensed under Apache 2.0 and MIT.
