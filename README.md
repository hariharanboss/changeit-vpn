# 🛡️ ChangeIt VPN: Stealth Firewall-Resilient VPN Client & Network Suite

[![Release](https://img.shields.io/github/v/release/hariharanboss/changeit-vpn?color=cyan&label=Latest%20Release)](https://github.com/hariharanboss/changeit-vpn/releases/latest)
[![Platform](https://img.shields.io/badge/Platforms-Windows%20%7C%20Android-blue)](https://github.com/hariharanboss/changeit-vpn/releases/latest)
[![Security Scan](https://img.shields.io/badge/VirusTotal-0%2F93%20Clean-success)](https://www.virustotal.com)
[![Package](https://img.shields.io/badge/Android%20Package-com.changeit.vpn-purple)](https://github.com/hariharanboss/changeit-vpn/releases/latest)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**ChangeIt VPN** is an open-source, multi-platform VPN and stealth proxy client engineered to bypass restrictive institutional, university, and enterprise firewalls (e.g., Fortinet FortiGuard, Palo Alto Networks, Cisco Firepower). By wrapping Layer 3 traffic into standard TLS 1.3 / WebSocket encrypted tunnels over **Port 443**, traffic becomes completely indistinguishable from standard HTTPS web browsing.

---

## 📥 Direct Downloads

| Platform | Download Link | Description | Architecture |
| :--- | :--- | :--- | :--- |
| **Android (arm64)** | [📥 **ChangeIt-arm64.apk**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.6/ChangeIt-arm64.apk) | Recommended for modern Android phones (v1.5.6) | ARM64 (64-bit) |
| **Android (Universal)** | [📥 **ChangeIt-Universal.apk**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.6/ChangeIt-Universal.apk) | Compatible with all Android devices | Universal |
| **Windows Desktop** | [📥 **ChangeIt-v1.5.6-Windows-x64.zip**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.6/ChangeIt-v1.5.6-Windows-x64.zip) | Portable Windows app — extract and run `ChangeIt.exe` | Windows x64 |
| **OTA Hot-Reload** | [📥 **app.asar**](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.6/app.asar) | Lightweight (~1.9 MB) hot-patch package | Cross-platform |

---

## ✨ Key Features

- **🔥 Unblockable Firewall Bypass**: Camouflages all traffic inside standard HTTPS/TLS on port 443. Deep Packet Inspection (DPI) sees legitimate encrypted web traffic.
- **⚡ 1-Tap Connect**: Zero complex configuration. Pre-configured high-speed stealth gateway ready out of the box.
- **🔄 Built-In In-App OTA Updates**:
  - **Android**: Version-tagged background downloads with automatic cache cleanup and native upgrade prompts.
  - **Desktop**: Super-lean hot-patching (~1.9MB `app.asar`) with live interface reload.
- **🛡️ 100% Antivirus Clean**: Verified **0/93 clean** on VirusTotal across all major security vendors. Signed with an official 4096-bit RSA certificate.
- **📊 Real-Time Telemetry**: Live ping latency, upload/download bandwidth charts, and gateway diagnostic indicators.
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
[ Your Device ] (Android / Windows)
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

## 📱 Mobile App Setup (Android)

1. **Install APK**: Download [`ChangeIt-arm64.apk`](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.6/ChangeIt-arm64.apk) and install it on your device.
2. **Launch & Connect**:
   - Open **ChangeIt**.
   - Tap the central connect button.
   - Accept the Android VPN permission prompt on first launch.
3. **Automatic Updates**: When future versions are released, tap **Update** directly inside the app for seamless background installation.

---

## 💻 Desktop App Setup (Windows)

1. **Download & Extract**: Download [`ChangeIt-v1.5.6-Windows-x64.zip`](https://github.com/hariharanboss/changeit-vpn/releases/download/v1.5.6/ChangeIt-v1.5.6-Windows-x64.zip) and extract it to any folder.
2. **Run**: Launch `ChangeIt.exe`.
3. **Connect**: Click **Connect**. The app verifies the tunnel before showing "Connected"; on failure it shows the reason and restores your internet settings.

### Windows troubleshooting
- Always install from the **full Windows zip**. `app.asar` is an in-app hot-patch only and cannot supply the tunnel core.
- If Connect fails, use **Re-check → Details** in the app for the exact cause and **Open logs** for `%APPDATA%\ChangeIt\logs\xray.log`.
- Antivirus blocking `xray.exe`: add an exclusion for the extracted ChangeIt folder.
- "Port 10808/10809 already in use": close other VPN/proxy clients and any second ChangeIt window.

### Running Desktop from Source:
```bash
# Clone the repository
git clone https://github.com/hariharanboss/changeit-vpn.git
cd changeit-vpn

# Install dependencies
npm install

# Start Vite + Electron in development mode
npm run electron:dev

# Build production distribution
npm run build
```

---

## 🛠️ Server-Side Setup Guide (Ubuntu / Debian VPS)

You can deploy your own ChangeIt stealth server on any standard Linux VPS (Ubuntu 22.04 / 24.04 or Debian 11 / 12) without needing kernel TUN modules:

### 1. Install Nginx & Dependencies
```bash
sudo apt update && sudo apt install -y nginx curl unzip certbot python3-certbot-nginx
```

### 2. Install Xray-Core
```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

### 3. Generate UUID & Configure Xray
Generate a unique user identifier:
```bash
xray uuid
```

Write `/usr/local/etc/xray/config.json`:
```json
{
  "log": {
    "loglevel": "warning"
  },
  "inbounds": [
    {
      "port": 10000,
      "listen": "127.0.0.1",
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "<YOUR_GENERATED_UUID>",
            "level": 0
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "ws",
        "wsSettings": {
          "path": "/tunnel"
        }
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom"
    }
  ]
}
```

Restart and enable the Xray service:
```bash
sudo systemctl restart xray && sudo systemctl enable xray
```

### 4. Configure Nginx Reverse Proxy
Edit `/etc/nginx/sites-available/default`:
```nginx
server {
    listen 80 default_server;
    server_name your-domain.com;

    location /tunnel {
        proxy_redirect off;
        proxy_pass http://127.0.0.1:10000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location / {
        root /var/www/html;
        index index.html;
    }
}
```

Enable SSL certificate with Certbot:
```bash
sudo certbot --nginx -d your-domain.com
sudo systemctl reload nginx
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
