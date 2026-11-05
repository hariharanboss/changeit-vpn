# 🛡️ ChangeIt: Campus & Enterprise Firewall-Resilient Network Client

An end-to-end open-source guide and multi-platform client engineered to bypass restrictive institutional, university, and enterprise firewalls (e.g., Fortinet FortiGuard, Palo Alto Networks, Cisco Firepower) by wrapping traffic into standard HTTPS WebSockets over TLS on Port 443.

Includes the full **Server Setup Guide**, client configurations for **Windows, Android, and iOS**, plus the **ChangeIt Desktop** client application codebase.

---

## 📑 Table of Contents
1. [The Problem: Why Traditional VPNs Fail on Campus Wi-Fi](#-the-problem-why-traditional-vpns-fail-on-campus-wi-fi)
2. [The Solution: VLESS over WebSocket + TLS (Port 443)](#-the-solution-vless-over-websocket--tls-port-443)
3. [Server-Side Setup Guide (Fresh Linux VPS / Container)](#-server-side-setup-guide-fresh-linux-vps--container)
4. [Client Setup Guides](#-client-setup-guides)
   - [Windows Setup (v2rayN)](#1-windows-desktop-setup)
   - [Android Setup (v2rayNG)](#2-android-mobile-setup)
   - [iOS / iPhone Setup (Streisand / V2Box)](#3-ios--iphone-setup)
5. [ChangeIt Desktop Client Architecture](#-changeit-desktop-client-architecture)
6. [Security & Privacy Properties](#-security--privacy-properties)
7. [License](#-license)

---

## 🔍 The Problem: Why Traditional VPNs Fail on Campus Wi-Fi

Enterprise firewall solutions employ multi-stage inspection to enforce strict traffic policies:

| Protocol | Default Transport | Why Enterprise Firewalls Block It |
| :--- | :--- | :--- |
| **WireGuard** | Fixed UDP (51820) | Outbound UDP is completely dropped; fixed 148-byte handshake is flagged by Deep Packet Inspection (DPI). |
| **Cloudflare WARP (1.1.1.1)** | UDP (443 / QUIC) | UDP 443 is blocked; Cloudflare Anycast IP ranges are sinkholed by campus routing tables. |
| **OpenVPN (UDP)** | UDP (1194) | Dropped by UDP port filters. |
| **OpenVPN (TCP 443)** | TCP (443) | Plaintext OpenVPN opcode negotiation (`0x38`/`0x28`) does not match standard TLS `ClientHello` syntax. |
| **IKEv2 / IPsec** | UDP (500, 4500) | Blocked by stateful firewall drop rules. |

Consumer mobile apps like JumpJumpVPN succeed where others fail because they do **not** use raw WireGuard or OpenVPN. Instead, they wrap Layer 3 IP traffic into an **obfuscated TCP/TLS 443 stream** (VLESS / Shadowsocks / WebSocket) that is indistinguishable from standard secure web traffic (e.g., loading `https://google.com`).

---

## 💡 The Solution: VLESS over WebSocket + TLS (Port 443)

```
[ Client Device ] (Windows / Android / iOS)
       │
       ▼ (Encrypted inside WSS / TLS 1.3 / Port 443)
[ Campus Firewall (FortiGuard) ] ──► Sees standard HTTPS web browsing to a legitimate domain ──► PERMITTED
       │
       ▼
[ Cloud VPS / Edge Node ] (Nginx Reverse Proxy)
       ├── Path: /          ──► Web application / normal site
       └── Path: /tunnel    ──► Xray Core (VLESS daemon on localhost:10000)
                                      │
                                      ▼
                              [ Open Internet ]
```

- **Protocol**: VLESS (Lightweight, stateless proxy protocol without encryption overhead when wrapped in TLS).
- **Transport**: WebSocket (`ws`).
- **Outer Security**: Standard TLS 1.3 certificate issued by Let's Encrypt or your cloud provider.
- **Port**: 443 (Standard HTTPS).
- **DPI Resistance**: Maximum. Traffic blends with web surfing, video conferencing, and standard cloud APIs.

---

## 🛠️ Server-Side Setup Guide (Fresh Linux VPS / Container)

Works on any Linux VPS or container (Ubuntu 22.04 / 24.04, Debian 11/12). **No kernel TUN device required!**

### Step 1: Install Nginx & Curl
```bash
sudo apt update && sudo apt install -y nginx curl unzip
```

### Step 2: Install Xray-Core
Run the official open-source Xray installation script:
```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

### Step 3: Configure Xray Daemon
Generate a random UUID for authentication:
```bash
xray uuid
```
*(Copy the generated UUID, or replace `<YOUR_RANDOM_UUID>` below).*

Create the configuration file at `/usr/local/etc/xray/config.json`:
```bash
cat << 'EOF' > /usr/local/etc/xray/config.json
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
            "id": "<YOUR_RANDOM_UUID>",
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
EOF
```

Restart Xray:
```bash
sudo systemctl restart xray && sudo systemctl enable xray
```

### Step 4: Configure Nginx WebSocket Reverse Proxy
Edit `/etc/nginx/sites-available/default` to forward `/tunnel` to Xray:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name YOUR_DOMAIN_OR_IP;

    client_max_body_size 0;

    # OpenTunnel VLESS WebSocket Endpoint
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

    # Default fallback website
    location / {
        root /var/www/html;
        index index.html;
    }
}
```

Verify syntax and reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

> **Note on TLS (SSL)**: Ensure your server domain has SSL enabled on port 443 (e.g., via Cloudflare, Certbot `sudo certbot --nginx`, or your cloud provider's HTTPS proxy URL).

---

## 📱 Client Setup Guides

Your universal client access link follows this standard format:
```text
vless://<YOUR_RANDOM_UUID>@<YOUR_SERVER_DOMAIN>:443?type=ws&security=tls&path=%2Ftunnel#OpenTunnel-Node
```

---

### 1. Windows Desktop Setup

1. **Download Client**: Download [v2rayN for Windows](https://github.com/2dust/v2rayN/releases) (`v2rayN-windows-64.zip`).
2. **Extract & Run**: Extract the zip and launch `v2rayN.exe`.
3. **Import Profile**: Copy your `vless://...` URL and press **Ctrl + V** inside v2rayN.
4. **Activate**:
   - Right-click your server $\to$ **Set as active server**.
   - At the bottom toolbar, set **System proxy** to **Set system proxy**.
   - Set **Routing** to **Global** (or Bypass LAN).
   - Toggle **Enable Tun** to **ON** (blue) for full-system VPN tunneling.
5. Connect to campus Wi-Fi and browse freely!

---

### 2. Android Mobile Setup

1. **Download App**:
   - Download the official APK from [v2rayNG GitHub Releases](https://github.com/2dust/v2rayNG/releases) (e.g., `v2rayNG_x.x.x.apk`), or install **NekoBox for Android** from Google Play Store.
2. **Import Key**:
   - Copy your `vless://...` access URL on your phone.
   - Open **v2rayNG**.
   - Tap the **`+`** icon in the top right $\to$ **Import config from Clipboard**.
3. **Connect**:
   - Tap the imported server card to select it.
   - Tap the circular **V** connect button at the bottom right.
   - Confirm Android's VPN connection prompt.

---

### 3. iOS / iPhone Setup

1. **Download App**:
   - Install **Streisand**, **V2Box**, or **Shadowrocket** from the Apple App Store.
2. **Import Key**:
   - Copy your `vless://...` access URL.
   - Open Streisand / V2Box $\to$ Tap **`+`** $\to$ **Import from Clipboard**.
3. **Connect**:
   - Tap your server and toggle the main connect switch.
   - Allow iOS to add the VPN configuration profile in Settings when prompted.

---

## 💻 OpenTunnel Desktop Client Architecture

The repository also includes the source code for **OpenTunnel Desktop**, a custom modular VPN frontend:

```
opentunnel-desktop/
├── src/
│   ├── components/
│   │   ├── ConnectButton.tsx        # Dynamic state ring with animated pulses
│   │   ├── TelemetryCards.tsx       # Live bandwidth (Mbps), ping, and IP readout
│   │   ├── ServerSelector.tsx       # Multi-protocol gateway switcher
│   │   └── NetworkDiagnosticModal.tsx # Firewall and UDP probe analyzer
│   ├── constants/servers.ts         # Profile roster configuration
│   ├── types/index.ts               # Core TypeScript telemetry and state models
│   ├── App.tsx                      # Dashboard view and engine logging
│   └── main.tsx                     # Entry point
├── scripts/
│   └── windows-engine.ps1           # Windows Filtering Platform (WFP) Kill Switch & NRPT DNS protection
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

### Running the Desktop Client locally:
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/opentunnel-desktop.git
cd opentunnel-desktop

# Install packages
npm install

# Start local interface
npm run dev
```

---

## 🔒 Security & Privacy Properties

- **Zero-Logging Gateway**: The server runs stateless Xray routing directly to target destinations without writing browsing history to disk.
- **Fail-Safe Kill Switch**: Out-of-tunnel data leaks during network drops are blocked using native Windows Filtering Platform (WFP) sub-layer filters.
- **DNS Leak Prevention**: Windows Name Resolution Policy Table (NRPT) rules bind wildcard (`.`) resolution strictly to encrypted tunnel DNS, preventing ISP or gateway interception.
- **TLS 1.3 Ciphers**: End-to-end data encryption is authenticated via modern AEAD ciphers (`ChaCha20-Poly1305` and `AES-256-GCM`).

---

## 📜 License
Dual-licensed under Apache 2.0 and MIT.
