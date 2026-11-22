# 🛡️ ChangeIt VPN: Stealth Firewall-Resilient VPN Client & Network Suite

[![Release](https://img.shields.io/github/v/release/hariharanboss/changeit-vpn?color=cyan&label=Latest%20Release)](https://github.com/hariharanboss/changeit-vpn/releases/latest)
[![Platform](https://img.shields.io/badge/Platforms-Windows%20%7C%20Android%20%7C%20Linux-blue)](https://github.com/hariharanboss/changeit-vpn/releases/latest)
[![Website](https://img.shields.io/badge/Website-hariharanboss.github.io%2Fchangeit--vpn-purple)](https://hariharanboss.github.io/changeit-vpn/)
[![Security Scan](https://img.shields.io/badge/VirusTotal-0%2F93%20Clean-success)](https://www.virustotal.com)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**ChangeIt VPN** is an open-source, multi-platform VPN and stealth proxy client engineered to bypass restrictive institutional, university, and enterprise firewalls (e.g., Fortinet FortiGuard, Palo Alto Networks, Cisco Firepower). By wrapping Layer 3 traffic into standard TLS 1.3 / WebSocket encrypted tunnels over **Port 443**, traffic becomes completely indistinguishable from standard HTTPS web browsing.

---

## 🌐 Official Website
Visit the official web portal: **[https://hariharanboss.github.io/changeit-vpn/](https://hariharanboss.github.io/changeit-vpn/)**

---

## 📥 Direct Downloads (v1.5.9)

| Platform | Download Link | Description | Architecture |
| :--- | :--- | :--- | :--- |
| **Windows (Installer)** | [📥 **ChangeIt-Setup-1.5.9.exe**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.9/ChangeIt-Setup-1.5.9.exe) | **Recommended**: 1-Click setup with desktop & menu shortcuts | Windows x64 |
| **Windows (Portable)** | [📥 **ChangeIt-v1.5.9-Windows-x64.zip**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.9/ChangeIt-v1.5.9-Windows-x64.zip) | Standalone portable archive — extract & run `ChangeIt.exe` | Windows x64 |
| **Android (arm64)** | [📥 **ChangeIt-arm64.apk**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.9/ChangeIt-arm64.apk) | **Recommended**: For modern Android phones (v1.5.9) | ARM64 (64-bit) |
| **Android (Universal)** | [📥 **ChangeIt-Universal.apk**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.9/ChangeIt-Universal.apk) | Compatible with all Android devices (ARM/x86) | Universal |
| **Linux (1-Line Install)** | `curl -fsSL https://raw.githubusercontent.com/hariharanboss/changeit-vpn/main/changeit-desktop/install-linux.sh \| bash` | Automated 1-line installer for all Linux distributions | x86_64 / amd64 |
| **Linux (Debian / Ubuntu)** | [📥 **ChangeIt-1.5.9-amd64.deb**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.9/ChangeIt-1.5.9-amd64.deb) | Native `.deb` package (Ubuntu, Debian, Mint, Pop!_OS) | x86_64 / amd64 |
| **Linux (AppImage)** | [📥 **ChangeIt-1.5.9-x86_64.AppImage**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.9/ChangeIt-1.5.9-x86_64.AppImage) | Standalone single-file executable for any Linux distro | x86_64 / amd64 |
| **Desktop Hot-Patch** | [📥 **app.asar**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.9/app.asar) | Lightweight (~364 KB) hot-swap update bundle | Cross-platform |

---

## ✨ Key Features

- **🔥 Unblockable Firewall Bypass**: Camouflages all traffic inside standard HTTPS/TLS on port 443. Deep Packet Inspection (DPI) sees legitimate encrypted web traffic.
- **🪟 Windows 1-Click Installer (`.exe`)**:
  - One-click setup automatically installs the application, provisions the background core, creates desktop & Start menu shortcuts, and registers an uninstaller.
  - Portable zip format also available for no-install usage.
- **📱 Android Widget & Launcher Shortcuts**:
  - **Proton-style Dark Home Screen Widget**: 1-tap connect/disconnect with live latency indicators.
  - **Long-Press App Shortcuts**: Direct actions on OnePlus / Android launchers: Toggle Connection, Connect, Disconnect, and Add Home Widget.
  - **Immediate Notification Disconnect Sync**: Stopping from the notification panel instantly updates widget and main UI.
- **🐧 Native Linux Client**:
  - 1-line terminal curl installer with automatic distro detection.
  - Native `.deb` package registering into system `/opt/changeit`, menu entries, and `/usr/local/bin/changeit`.
  - Standalone single-file `.AppImage` executable for Fedora, Arch, openSUSE, and any distribution.
  - Automatic GNOME desktop system proxy routing via `gsettings`.
- **⚡ 1-Tap Connect & Verified Tunnel**:
  - Zero complex configuration. Pre-configured high-speed stealth gateway ready out of the box.
  - Verifies tunnel reachability before displaying "Connected"; restores system network settings automatically on disconnect.
- **🔄 Built-In In-App OTA Updates**:
  - **Android**: Version-tagged background downloads with native upgrade prompts.
  - **Desktop (Windows/Linux)**: Super-lean hot-patching (`app.asar`) with live interface reload.
  - **Manual Update Checker**: Instant `[⟳]` button next to the version badge on both mobile and desktop.
- **🛡️ 100% Antivirus Clean**: Verified **0/93 clean** on VirusTotal across all major security vendors.
- **📊 Real-Time Telemetry**: Live ping latency, upload/download bandwidth counters, and gateway diagnostic logs.
- **🔒 Zero-Logging & Privacy First**: Stateless routing with zero DNS leaks and no browsing activity recorded.

---

## 🔍 How It Works: The Protocol Difference

Standard VPN protocols fail on institutional firewalls because their signatures are trivial to identify and drop:

| Protocol | Transport | Why Campus & Enterprise Firewalls Block It |
| :--- | :--- | :--- |
| **WireGuard** | Fixed UDP (51820) | Outbound UDP is completely dropped; fixed 148-byte handshake triggers DPI filters. |
| **Cloudflare WARP** | UDP (443 / QUIC) | UDP 443 is blocked; Cloudflare Anycast IP ranges are sinkholed by campus routing tables. |
| **OpenVPN (UDP)** | UDP (1194) | Blocked by UDP stateful drop rules. |
| **OpenVPN (TCP 443)** | TCP (443) | Opcode negotiation (`0x38`/`0x28`) fails TLS `ClientHello` syntax inspection. |
| **ChangeIt (VLESS)** | **TCP / TLS 1.3 (443)** | **Permitted.** Appears as standard HTTPS traffic to legitimate web hosts. |

```
[ Your Device ] (Windows / Android / Linux)
       │
       ▼ (Encrypted inside TLS 1.3 over Port 443)
[ Campus Firewall (Fortinet / Palo Alto) ] ──► Sees standard HTTPS web browsing ──► ALLOWED
       │
       ▼
[ Cloud Edge Node ] (Nginx Reverse Proxy / Xray Daemon)
       ├── HTTPS Root (/)       ──► Normal website
       └── Tunnel Path (/tunnel) ──► Xray Core (VLESS on localhost:10000)
                                      │
                                      ▼
                              [ Open Internet ]
```

---

## 💻 Windows Setup

### Option 1: 1-Click Installer (Recommended)
1. Download [**ChangeIt-Setup-1.5.9.exe**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.9/ChangeIt-Setup-1.5.9.exe).
2. Double-click to install. It installs to your user profile, creates Desktop & Start Menu shortcuts, and launches the app.
3. Click **Connect**.

### Option 2: Portable ZIP
1. Download [**ChangeIt-v1.5.9-Windows-x64.zip**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.9/ChangeIt-v1.5.9-Windows-x64.zip).
2. Extract to any folder and run `ChangeIt.exe`.

---

## 📱 Mobile Setup (Android)

1. **Install APK**: Download [`ChangeIt-arm64.apk`](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.9/ChangeIt-arm64.apk) (or [`ChangeIt-Universal.apk`](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.9/ChangeIt-Universal.apk)) and install it.
2. **Launch & Connect**: Open **ChangeIt**, tap connect, and accept the Android VPN permission prompt on first launch.
3. **Home Screen Widget & Shortcuts**:
   - Long-press the **ChangeIt** app icon to access quick shortcuts: **Toggle Connection**, **Connect**, **Disconnect**, or **Add Home Widget**.
   - Tap **Add Home Widget** to pin the modern dark widget directly to your home screen.
4. **Notification Synchronization**:
   - Stopping the VPN from the notification bar instantly updates the widget and app status.

---

## 🐧 Linux Setup

### Option 1: 1-Line Terminal Install (Recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/hariharanboss/changeit-vpn/main/changeit-desktop/install-linux.sh | bash
```

### Option 2: Native `.deb` Package (Ubuntu / Debian / Mint)
```bash
sudo apt install ./ChangeIt-1.5.9-amd64.deb
changeit
```

### Option 3: Standalone `.AppImage` (Any Distribution)
```bash
chmod +x ChangeIt-1.5.9-x86_64.AppImage
./ChangeIt-1.5.9-x86_64.AppImage
```

---

## 🛠️ Building From Source

### Desktop Client (Electron + Vite + React)
```bash
# Clone the repository
git clone https://github.com/hariharanboss/changeit-vpn.git
cd changeit-vpn/changeit-desktop

# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Package installer (.exe), portable zip, and Linux packages
npm run package:win
npm run release:ota
```

### Android Client (Kotlin + Jetpack Compose)
```powershell
cd changeit-mobile\V2rayNG
./gradlew.bat assembleFdroidRelease
```

---

## 🔒 Security & Privacy Guarantees

- **Stateless Routing**: Xray forwards traffic without disk logging or connection tracking.
- **No DNS Leaks**: All DNS queries are forwarded into the encrypted tunnel (1.1.1.1 / 8.8.8.8) using encrypted transport.
- **Fail-Safe Disconnect**: Automatically restores system default network routes upon exit.
- **Signed Binaries**: Android release signed with 4096-bit RSA certificate using APK Signature Scheme v2 & v3.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
