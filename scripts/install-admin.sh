#!/usr/bin/env bash
# ==============================================================================
# ChangeIt Admin Suite - 1-Click Installer
# Deploys private PWA dashboard at https://<your-domain>/c-portal/
# ==============================================================================
set -e

echo ""
echo "=========================================================="
echo "   🛡️ ChangeIt VPN - Private Admin Suite Setup (/c-portal)   "
echo "=========================================================="
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run as root (sudo bash install-admin.sh)"
  exit 1
fi

# Prompt for Admin Master Password
echo "[?] Set your Master Password / PIN to access the Admin Portal:"
read -r -s -p "Enter Master Password: " ADMIN_PASS
echo ""
while [ -z "$ADMIN_PASS" ]; do
  read -r -s -p "Password cannot be empty. Enter Master Password: " ADMIN_PASS
  echo ""
done

# Ensure python3 and sqlite3 are installed
echo "[*] Checking system packages..."
apt-get update -y >/dev/null 2>&1 || true
apt-get install -y python3 curl sqlite3 >/dev/null 2>&1 || true

# Setup install directories
APP_DIR="/opt/changeit-admin"
DATA_DIR="/var/lib/changeit-admin"
mkdir -p "$APP_DIR" "$DATA_DIR"

# Generate password hash and salt
SALT=$(python3 -c "import secrets; print(secrets.token_hex(16))")
PASS_HASH=$(python3 -c "import hashlib; print(hashlib.sha256(('$ADMIN_PASS' + '$SALT').encode()).hexdigest())")
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")

# Save credentials securely
cat <<EOF > "$DATA_DIR/auth.json"
{
  "salt": "$SALT",
  "hash": "$PASS_HASH",
  "secret_key": "$SECRET_KEY"
}
EOF
chmod 600 "$DATA_DIR/auth.json"

# Write the python server
cat << 'EOF' > "$APP_DIR/server.py"
#!/usr/bin/env python3
import http.server
import socketserver
import threading
import json
import sqlite3
import urllib.request
import hashlib
import hmac
import os
import sys
import re
import time
from urllib.parse import urlparse, parse_qs

PORT = 3005
DATA_DIR = "/var/lib/changeit-admin"
DB_PATH = os.path.join(DATA_DIR, "admin.db")
AUTH_FILE = os.path.join(DATA_DIR, "auth.json")
NGINX_LOG = "/var/log/nginx/access.log"
XRAY_LOG = "/var/log/xray/access.log"

# Server loopback and internal gateway IPs to exclude
SERVER_IPS = {"127.0.0.1", "::1", "135.125.222.22", "10.10.10.99"}

# In-memory GeoIP cache to avoid duplicate HTTP lookups
GEO_CACHE = {}

# --- Database Setup ---
def init_db():
    try:
        with sqlite3.connect(DB_PATH, timeout=5.0) as conn:
            c = conn.cursor()
            c.execute('PRAGMA journal_mode=WAL')
            c.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    ip TEXT PRIMARY KEY,
                    city TEXT,
                    region TEXT,
                    country TEXT,
                    country_code TEXT,
                    isp TEXT,
                    first_seen INTEGER,
                    last_seen INTEGER,
                    connections INTEGER DEFAULT 1,
                    is_online INTEGER DEFAULT 0
                )
            ''')
            c.execute('''
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER,
                    ip TEXT,
                    action TEXT
                )
            ''')
            # Clean out local loopback artifacts
            c.execute("DELETE FROM users WHERE ip LIKE '%127.0.0.1%' OR ip IN ('135.125.222.22', '10.10.10.99')")
            c.execute("DELETE FROM events WHERE ip LIKE '%127.0.0.1%' OR ip IN ('135.125.222.22', '10.10.10.99')")
            conn.commit()
    except Exception as e:
        print(f"init_db error: {e}")

# --- GeoIP Lookup (Cached) ---
def lookup_ip(ip, cached_geo=None):
    if ip in GEO_CACHE:
        return GEO_CACHE[ip]
    if cached_geo and cached_geo.get('city') and cached_geo.get('city') != 'Unknown':
        GEO_CACHE[ip] = cached_geo
        return cached_geo
    # Skip local IPs
    if ip.startswith(('127.', '10.', '192.168.', '172.')) or ip == '::1' or ip in SERVER_IPS:
        res = {"city": "Local Network", "region": "LAN", "country": "Local", "country_code": "IN", "isp": "Intranet"}
        GEO_CACHE[ip] = res
        return res
    
    try:
        url = f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,regionName,city,isp"
        req = urllib.request.Request(url, headers={'User-Agent': 'ChangeItAdmin/1.0'})
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if data.get('status') == 'success':
                res = {
                    "city": data.get('city', 'Unknown'),
                    "region": data.get('regionName', 'Unknown'),
                    "country": data.get('country', 'Unknown'),
                    "country_code": data.get('countryCode', 'UN'),
                    "isp": data.get('isp', 'Unknown ISP')
                }
                GEO_CACHE[ip] = res
                return res
    except Exception:
        pass
    fallback = {"city": "Active Node", "region": "State", "country": "India", "country_code": "IN", "isp": "Cellular / Broadband"}
    GEO_CACHE[ip] = fallback
    return fallback

# --- Active Established Sockets on port 80 / 443 ---
def get_active_client_ips():
    active = set()
    try:
        with os.popen("ss -tn state established") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 4:
                    local_addr = parts[2]
                    peer_addr = parts[3]
                    if ":80" in local_addr or ":443" in local_addr:
                        ip = peer_addr.rsplit(":", 1)[0].strip("[]").replace("::ffff:", "")
                        if ip and ip not in SERVER_IPS and not ip.startswith(('127.', '10.', '192.168.', '172.')):
                            active.add(ip)
    except Exception as e:
        print(f"get_active_client_ips error: {e}")
    return active

# --- Real-Time Link & Destination Tracking from Xray Core ---
def sync_xray_traffic(active_clients, conn):
    if not os.path.exists(XRAY_LOG):
        return
    try:
        c = conn.cursor()
        now = int(time.time())
        primary_client = next(iter(active_clients)) if active_clients else None
        if not primary_client:
            c.execute("SELECT ip FROM users WHERE is_online = 1 ORDER BY last_seen DESC LIMIT 1")
            row = c.fetchone()
            if row:
                primary_client = row[0]
            else:
                c.execute("SELECT ip FROM users ORDER BY last_seen DESC LIMIT 1")
                row2 = c.fetchone()
                if row2:
                    primary_client = row2[0]

        with os.popen(f"tail -n 60 {XRAY_LOG}") as f:
            for line in f:
                m = re.search(r"accepted\s+(?:tcp|udp):([^ ]+)", line)
                if m:
                    dest = m.group(1).strip()
                    display_dest = dest.replace(":443", "").replace(":80", "")
                    
                    # Direct client IP if present, otherwise attribute to primary active user
                    client_ip = primary_client
                    m_ip = re.search(r"(?:tcp|udp):(\[[a-fA-F0-9:]+\]|[\d\.]+):\d+\s+accepted", line)
                    if m_ip:
                        extracted = m_ip.group(1).strip("[]").replace("::ffff:", "")
                        if extracted not in SERVER_IPS and not extracted.startswith(('127.', '10.', '192.168.', '172.')):
                            client_ip = extracted

                    if not client_ip:
                        client_ip = "Active Device"

                    action = f"Browsing {display_dest}"
                    c.execute("SELECT id FROM events WHERE ip = ? AND action = ? AND ? - timestamp < 10", (client_ip, action, now))
                    if not c.fetchone():
                        c.execute("INSERT INTO events (timestamp, ip, action) VALUES (?, ?, ?)",
                                  (now, client_ip, action))
    except Exception as e:
        print(f"sync_xray_traffic error: {e}")

# --- Sync from Nginx Access Log and Active Sockets ---
def sync_logs():
    try:
        now = int(time.time())
        seen_ips = {}

        # 1. Real-time active TCP connections on port 443 / 80
        active_sockets = get_active_client_ips()
        for ip in active_sockets:
            seen_ips[ip] = seen_ips.get(ip, 0) + 1

        # 2. Requests from Nginx access log
        if os.path.exists(NGINX_LOG):
            with os.popen(f"tail -n 200 {NGINX_LOG}") as f:
                for line in f:
                    if "/tunnel" in line or "101" in line:
                        match = re.match(r"^(\S+)", line)
                        if match:
                            client_ip = match.group(1).strip()
                            if client_ip and client_ip not in SERVER_IPS and not client_ip.startswith(('127.', '10.', '192.168.', '172.', 'tcp:')):
                                seen_ips[client_ip] = seen_ips.get(client_ip, 0) + 1

        with sqlite3.connect(DB_PATH, timeout=5.0) as conn:
            c = conn.cursor()
            # Clean out local loopback artifacts
            c.execute("DELETE FROM users WHERE ip LIKE '%127.0.0.1%' OR ip IN ('135.125.222.22', '10.10.10.99')")
            c.execute("DELETE FROM events WHERE ip LIKE '%127.0.0.1%' OR ip IN ('135.125.222.22', '10.10.10.99')")

            for client_ip, count in seen_ips.items():
                c.execute("SELECT city, region, country, country_code, isp, first_seen FROM users WHERE ip = ?", (client_ip,))
                row = c.fetchone()
                if row:
                    geo = lookup_ip(client_ip, {"city": row[0], "region": row[1], "country": row[2], "country_code": row[3], "isp": row[4]})
                    c.execute('''
                        UPDATE users SET 
                            last_seen = ?, 
                            connections = connections + ?,
                            is_online = 1,
                            city = ?, region = ?, country = ?, country_code = ?, isp = ?
                        WHERE ip = ?
                    ''', (now, count, geo['city'], geo['region'], geo['country'], geo['country_code'], geo['isp'], client_ip))
                else:
                    geo = lookup_ip(client_ip)
                    c.execute('''
                        INSERT INTO users (ip, city, region, country, country_code, isp, first_seen, last_seen, connections, is_online)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                    ''', (client_ip, geo['city'], geo['region'], geo['country'], geo['country_code'], geo['isp'], now, now, count))
                    c.execute("INSERT INTO events (timestamp, ip, action) VALUES (?, ?, ?)",
                              (now, client_ip, f"Connected from {geo['city']}, {geo['region']}"))

            # Mark users offline if not seen in 5 minutes
            c.execute("UPDATE users SET is_online = 0 WHERE ? - last_seen > 300", (now,))

            # 3. Correlate real-time link access from Xray Core
            sync_xray_traffic(active_sockets, conn)

            conn.commit()
    except Exception as e:
        print(f"sync_logs error: {e}")

def background_sync_worker():
    while True:
        try:
            sync_logs()
        except Exception:
            pass
        time.sleep(5)

# --- Auth Verification ---
def verify_token(token):
    if not os.path.exists(AUTH_FILE) or not token:
        return False
    try:
        with open(AUTH_FILE, "r") as f:
            auth = json.load(f)
        secret = auth.get("secret_key", "")
        # Token format: timestamp.signature
        parts = token.rsplit(".", 1)
        if len(parts) != 2:
            return False
        ts, sig = parts[0], parts[1]
        # Valid for 30 days
        if time.time() - float(ts) > 30 * 86400:
            return False
        expected_sig = hmac.new(secret.encode(), ts.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(sig, expected_sig)
    except Exception:
        return False

# --- Network Stats ---
prev_rx = 0
prev_tx = 0
prev_time = time.time()

def get_network_speeds():
    global prev_rx, prev_tx, prev_time
    cur_rx, cur_tx = 0, 0
    try:
        with open("/proc/net/dev", "r") as f:
            for line in f:
                if ":" in line:
                    parts = line.split(":")
                    iface = parts[0].strip()
                    if iface != "lo":
                        stats = parts[1].split()
                        cur_rx += int(stats[0])
                        cur_tx += int(stats[8])
    except Exception:
        pass
    
    now = time.time()
    dt = max(now - prev_time, 1)
    rx_speed = max(0, (cur_rx - prev_rx) / dt / (1024 * 1024) * 8) if prev_rx > 0 else 0
    tx_speed = max(0, (cur_tx - prev_tx) / dt / (1024 * 1024) * 8) if prev_tx > 0 else 0
    
    prev_rx, prev_tx, prev_time = cur_rx, cur_tx, now
    return round(rx_speed, 2), round(tx_speed, 2), round((cur_rx + cur_tx) / (1024 * 1024 * 1024), 2)

# --- Web Handler ---
class AdminHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        path = url.path.rstrip('/')

        # Static assets
        if path == "/c-portal/manifest.json":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            manifest = {
                "name": "ChangeIt Admin",
                "short_name": "ChangeIt Admin",
                "start_url": "/c-portal/",
                "display": "standalone",
                "background_color": "#0a0d14",
                "theme_color": "#0a0d14"
            }
            self.wfile.write(json.dumps(manifest).encode('utf-8'))
            return

        # API Stats
        if path == "/c-portal/api/stats":
            auth_header = self.headers.get("Authorization", "")
            token = auth_header.replace("Bearer ", "").strip()
            if not verify_token(token):
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Unauthorized"}).encode('utf-8'))
                return

            users = []
            events = []
            active_count = 0
            try:
                with sqlite3.connect(DB_PATH, timeout=5.0) as conn:
                    c = conn.cursor()
                    c.execute("SELECT ip, city, region, country, country_code, isp, first_seen, last_seen, connections, is_online FROM users ORDER BY last_seen DESC")
                    for r in c.fetchall():
                        is_on = bool(r[9])
                        if is_on: active_count += 1
                        users.append({
                            "ip": r[0],
                            "city": r[1],
                            "region": r[2],
                            "country": r[3],
                            "country_code": r[4],
                            "isp": r[5],
                            "first_seen": r[6],
                            "last_seen": r[7],
                            "connections": r[8],
                            "is_online": is_on
                        })

                    c.execute("SELECT timestamp, ip, action FROM events ORDER BY id DESC LIMIT 50")
                    events = [{"time": r[0], "ip": r[1], "action": r[2]} for r in c.fetchall()]
            except Exception as e:
                print(f"Stats query error: {e}")

            rx_speed, tx_speed, total_gb = get_network_speeds()

            res = {
                "active_users": active_count,
                "total_users": len(users),
                "speed_rx_mbps": rx_speed,
                "speed_tx_mbps": tx_speed,
                "total_gb": total_gb,
                "users": users,
                "events": events
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(res).encode('utf-8'))
            return

        # Main HTML Dashboard
        if path == "/c-portal" or path == "":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_DASHBOARD.encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        url = urlparse(self.path)
        path = url.path.rstrip('/')

        if path == "/c-portal/api/login":
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body)
                provided_pass = data.get("password", "")
                with open(AUTH_FILE, "r") as f:
                    auth = json.load(f)
                salt = auth.get("salt", "")
                expected_hash = auth.get("hash", "")
                secret = auth.get("secret_key", "")
                
                check_hash = hashlib.sha256((provided_pass + salt).encode()).hexdigest()
                if hmac.compare_digest(check_hash, expected_hash):
                    ts = str(int(time.time()))
                    sig = hmac.new(secret.encode(), ts.encode(), hashlib.sha256).hexdigest()
                    token = f"{ts}.{sig}"
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps({"token": token}).encode('utf-8'))
                    return
            except Exception:
                pass
            
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid Master Password"}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

# --- Responsive Cyber Dashboard UI ---
HTML_DASHBOARD = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ChangeIt Admin</title>
  <link rel="manifest" href="/c-portal/manifest.json">
  <meta name="theme-color" content="#0a0d14">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #07090e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #f1f5f9; }
    .glass { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); }
    .pulse-glow { box-shadow: 0 0 15px rgba(16, 185, 129, 0.3); }
  </style>
</head>
<body class="p-4 md:p-8 min-h-screen">
  <!-- Auth Overlay -->
  <div id="login-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
    <div class="glass p-6 md:p-8 rounded-2xl w-full max-w-sm text-center shadow-2xl border border-white/10">
      <div class="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
      </div>
      <h2 class="text-xl font-bold text-white mb-1">ChangeIt Master Suite</h2>
      <p class="text-xs text-slate-400 mb-6">Enter Master Password / PIN to access telemetry</p>
      <input type="password" id="pass-input" placeholder="Enter Password" class="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 mb-4 focus:outline-none focus:border-cyan-500 text-center tracking-widest text-lg" onkeydown="if(event.key==='Enter') login()">
      <button onclick="login()" class="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-xl transition duration-200">Unlock Dashboard</button>
      <p id="login-err" class="text-rose-400 text-xs mt-3 hidden">Invalid Password</p>
    </div>
  </div>

  <!-- Dashboard Container -->
  <div id="dashboard" class="max-w-6xl mx-auto hidden">
    <!-- Header -->
    <header class="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-black text-xl">C</div>
        <div>
          <h1 class="text-lg md:text-xl font-bold tracking-tight">ChangeIt <span class="text-cyan-400 font-mono text-sm">/ Admin Portal</span></h1>
          <p class="text-xs text-slate-400 flex items-center space-x-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Gateway Online • 135.125.222.22</span>
          </p>
        </div>
      </div>
      <button onclick="logout()" class="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs text-slate-300 transition">Logout</button>
    </header>

    <!-- Metrics Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="glass p-4 rounded-xl">
        <p class="text-xs text-slate-400 mb-1">Active Users</p>
        <div class="flex items-baseline space-x-2">
          <span id="stat-active" class="text-2xl md:text-3xl font-black text-emerald-400">0</span>
          <span class="text-xs text-emerald-500/80 font-mono">online now</span>
        </div>
      </div>
      <div class="glass p-4 rounded-xl">
        <p class="text-xs text-slate-400 mb-1">Total Devices Seen</p>
        <span id="stat-total" class="text-2xl md:text-3xl font-black text-white">0</span>
      </div>
      <div class="glass p-4 rounded-xl">
        <p class="text-xs text-slate-400 mb-1">Live Download</p>
        <div class="flex items-baseline space-x-1">
          <span id="stat-rx" class="text-2xl md:text-3xl font-black text-cyan-400">0.0</span>
          <span class="text-xs text-slate-400 font-mono">Mbps</span>
        </div>
      </div>
      <div class="glass p-4 rounded-xl">
        <p class="text-xs text-slate-400 mb-1">Total Transferred</p>
        <div class="flex items-baseline space-x-1">
          <span id="stat-total-gb" class="text-2xl md:text-3xl font-black text-purple-400">0.0</span>
          <span class="text-xs text-slate-400 font-mono">GB</span>
        </div>
      </div>
    </div>

    <!-- Active Connections & Location Table -->
    <div class="glass rounded-2xl overflow-hidden mb-6">
      <div class="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 class="font-bold text-sm text-white flex items-center space-x-2">
          <span>👥 Connected Users & Locations</span>
        </h3>
        <span class="text-xs text-slate-400" id="last-refreshed">Refreshing...</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-900/40 text-slate-400 border-b border-white/5 uppercase tracking-wider text-[10px]">
            <tr>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Location & State</th>
              <th class="py-3 px-4">ISP / Carrier</th>
              <th class="py-3 px-4">Client IP</th>
              <th class="py-3 px-4">Last Active</th>
            </tr>
          </thead>
          <tbody id="user-rows" class="divide-y divide-white/5 text-slate-300">
            <tr><td colspan="5" class="py-6 text-center text-slate-500">Loading user telemetry...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Live Event Feed -->
    <div class="glass rounded-2xl p-4">
      <h3 class="font-bold text-sm text-white mb-3 flex items-center space-x-2">
        <span>📜 Live Tunnel Event Log</span>
      </h3>
      <div id="event-feed" class="h-40 overflow-y-auto font-mono text-[11px] space-y-1.5 text-slate-400 pr-2">
        <p class="text-slate-500">Waiting for live traffic events...</p>
      </div>
    </div>
  </div>

  <script>
    let token = localStorage.getItem('changeit_admin_token');

    async function login() {
      const pass = document.getElementById('pass-input').value;
      const res = await fetch('/c-portal/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password: pass})
      });
      if (res.ok) {
        const data = await res.json();
        token = data.token;
        localStorage.setItem('changeit_admin_token', token);
        document.getElementById('login-modal').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        fetchStats();
      } else {
        document.getElementById('login-err').classList.remove('hidden');
      }
    }

    function logout() {
      localStorage.removeItem('changeit_admin_token');
      location.reload();
    }

    async function fetchStats() {
      if (!token) return;
      try {
        const res = await fetch('/c-portal/api/stats', {
          headers: {'Authorization': 'Bearer ' + token}
        });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();

        document.getElementById('stat-active').innerText = data.active_users;
        document.getElementById('stat-total').innerText = data.total_users;
        document.getElementById('stat-rx').innerText = data.speed_rx_mbps;
        document.getElementById('stat-total-gb').innerText = data.total_gb;
        document.getElementById('last-refreshed').innerText = 'Live • ' + new Date().toLocaleTimeString();

        // Populate table
        const tbody = document.getElementById('user-rows');
        if (data.users.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-500">No client connections logged yet.</td></tr>';
        } else {
          tbody.innerHTML = data.users.map(u => `
            <tr class="hover:bg-white/[0.02] transition">
              <td class="py-3 px-4">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${u.is_online ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}">
                  ${u.is_online ? '● Online' : 'Idle'}
                </span>
              </td>
              <td class="py-3 px-4 font-medium text-white">
                📍 ${u.city || 'Unknown'}, ${u.region || ''} (${u.country_code || ''})
              </td>
              <td class="py-3 px-4 text-slate-300">${u.isp || 'Broadband'}</td>
              <td class="py-3 px-4 font-mono text-slate-400">${u.ip}</td>
              <td class="py-3 px-4 text-slate-400">${timeAgo(u.last_seen)}</td>
            </tr>
          `).join('');
        }

        // Populate events
        const feed = document.getElementById('event-feed');
        if (data.events && data.events.length > 0) {
          feed.innerHTML = data.events.map(e => `
            <div class="flex items-center space-x-2">
              <span class="text-slate-600">[${new Date(e.time * 1000).toLocaleTimeString()}]</span>
              <span class="text-cyan-400 font-bold">${e.ip}</span>
              <span class="text-slate-300">➔ ${e.action}</span>
            </div>
          `).join('');
        }
      } catch (err) {
        console.error("fetchStats error:", err);
      }
    }

    function timeAgo(epoch) {
      const sec = Math.floor(Date.now() / 1000) - epoch;
      if (sec < 60) return 'Just now';
      if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
      if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
      return Math.floor(sec / 86400) + 'd ago';
    }

    if (token) {
      document.getElementById('login-modal').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      fetchStats();
    }
    setInterval(fetchStats, 3000);
  </script>
</body>
</html>
'''

if __name__ == '__main__':
    init_db()
    sync_thread = threading.Thread(target=background_sync_worker, daemon=True)
    sync_thread.start()
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), AdminHandler) as httpd:
        print(f"ChangeIt Admin daemon listening on 127.0.0.1:{PORT}")
        httpd.serve_forever()


chmod +x "$APP_DIR/server.py"

# Create Systemd Service
echo "[*] Creating systemd service changeit-admin.service..."
cat <<EOF > /etc/systemd/system/changeit-admin.service
[Unit]
Description=ChangeIt Admin Telemetry & PWA Service
After=network.target nginx.service

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/python3 $APP_DIR/server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable changeit-admin.service
systemctl restart changeit-admin.service

# Update Nginx Configuration
echo "[*] Adding /c-portal location block to Nginx..."
NGINX_CONF="/etc/nginx/sites-available/default"

if [ -f "$NGINX_CONF" ]; then
  # Remove any older c-portal blocks if present
  sed -i '/location \/c-portal/,/^[[:space:]]*}/d' "$NGINX_CONF"
  
  # Insert new block before the last closing brace
  sed -i '/location \/tunnel/i \
    location /c-portal {\
        proxy_pass http://127.0.0.1:3005;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
    }\
' "$NGINX_CONF"

  # Configure Nginx Real-IP module so proxy headers reveal actual client IPs
  cat << 'REALIP_EOF' > /etc/nginx/conf.d/realip.conf
  set_real_ip_from 0.0.0.0/0;
  real_ip_header X-Forwarded-For;
  real_ip_recursive on;
REALIP_EOF

  nginx -t && systemctl reload nginx
fi

echo ""
echo "=========================================================="
echo "   🎉 ChangeIt Admin Suite Successfully Deployed!        "
echo "=========================================================="
echo ""
echo "👉 Private URL: https://i3owy.aiccloud.online/c-portal/"
echo "🔑 Login with the Master Password you just set."
echo ""
echo "📱 On Mobile: Open in Chrome/Safari -> tap 'Add to Home Screen' to install app."
echo ""
