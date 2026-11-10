const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn, exec, execFile } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');
const net = require('net');
const os = require('os');

// Prevent unexpected electron dialogs on background tasks
process.on('uncaughtException', (err) => {
  console.error('ChangeIt Main Exception:', err);
});

const HTTP_PROXY_PORT = 10809;
const SOCKS_PROXY_PORT = 10808;
const PROXY_SERVER = `127.0.0.1:${HTTP_PROXY_PORT}`;
const PROBE_HOST = 'www.gstatic.com';
const PROBE_PORT = 443;

let mainWindow;
let tray = null;
let isQuitting = false;
let xrayProcess = null;
let updateDownloadedPath = null;
let newVersionAvailable = null;
let disconnectRequested = false;
let tunnelActive = false;
let lastSpawnError = null;

// Dynamic Remote Config URL (reads from local config.endpoint.json or CHANGEIT_CONFIG_URL env var)
function getRemoteConfigUrl() {
  if (process.env.CHANGEIT_CONFIG_URL) return process.env.CHANGEIT_CONFIG_URL;
  try {
    const candidatePaths = [
      path.join(__dirname, '..', 'config.endpoint.json'),
      path.join(process.resourcesPath, 'config.endpoint.json'),
      path.join(path.dirname(app.getPath('exe')), 'config.endpoint.json'),
      path.join(app.getPath('userData'), 'config.endpoint.json')
    ];
    for (const epPath of candidatePaths) {
      if (fs.existsSync(epPath)) {
        const cfg = JSON.parse(fs.readFileSync(epPath, 'utf-8'));
        if (cfg && cfg.url) return cfg.url;
      }
    }
  } catch (_) {}
  return null;
}

function getBypassIps() {
  const defaultIps = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'];
  try {
    const userBypassFile = path.join(app.getPath('userData'), 'bypass.json');
    if (fs.existsSync(userBypassFile)) {
      const custom = JSON.parse(fs.readFileSync(userBypassFile, 'utf-8'));
      if (Array.isArray(custom.ips)) {
        return [...defaultIps, ...custom.ips];
      }
    }
  } catch (_) {}
  return defaultIps;
}

function getBypassPorts() {
  const defaultPorts = '22,2222,20091';
  try {
    const userBypassFile = path.join(app.getPath('userData'), 'bypass.json');
    if (fs.existsSync(userBypassFile)) {
      const custom = JSON.parse(fs.readFileSync(userBypassFile, 'utf-8'));
      if (custom.ports) {
        return `${defaultPorts},${custom.ports}`;
      }
    }
  } catch (_) {}
  return defaultPorts;
}

// ---- Logging ---------------------------------------------------------------

function getLogDir() {
  const dir = path.join(app.getPath('userData'), 'logs');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

function getXrayLogPath() {
  return path.join(getLogDir(), 'xray.log');
}

function appendLog(file, text) {
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > 2 * 1024 * 1024) {
      fs.renameSync(file, `${file}.1`);
    }
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${text}`, 'utf-8');
  } catch (_) {}
}

function logEvent(message) {
  appendLog(path.join(getLogDir(), 'changeit.log'), `${message}\n`);
}

function readLogTail(file, maxBytes = 4000) {
  try {
    const size = fs.statSync(file).size;
    const start = Math.max(0, size - maxBytes);
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    return buf.toString('utf-8');
  } catch (_) {
    return '';
  }
}

// ---- Windows system proxy --------------------------------------------------

function refreshProxySettings() {
  // WinINET caches proxy settings; registry writes alone are not picked up by
  // every app without InternetSetOption(REFRESH / SETTINGS_CHANGED).
  const script = [
    '$sig = @"',
    '[DllImport("wininet.dll", SetLastError = true, CharSet = CharSet.Auto)]',
    'public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);',
    '"@',
    'Add-Type -MemberDefinition $sig -Name WinINet -Namespace ChangeIt -ErrorAction SilentlyContinue | Out-Null',
    '[ChangeIt.WinINet]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null',
    '[ChangeIt.WinINet]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null'
  ].join('\r\n');

  try {
    const scriptPath = path.join(getLogDir(), 'refresh-proxy.ps1');
    if (!fs.existsSync(scriptPath)) fs.writeFileSync(scriptPath, script, 'utf-8');
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
      '-ExecutionPolicy', 'Bypass', '-File', scriptPath
    ], { windowsHide: true, timeout: 8000 }, () => {});
  } catch (_) {}
}

function setWindowsProxy(enable) {
  if (enable) {
    const overrideList = '<local>;localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*;135.125.222.22';
    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f');
    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:10809" /f');
    exec(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyOverride /t REG_SZ /d "${overrideList}" /f`);
    refreshProxySettings();
    logEvent('System proxy enabled -> ' + PROXY_SERVER);
  } else {
    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f');
    refreshProxySettings();
    logEvent('System proxy disabled');
  }
}

function readRegistryValue(name) {
  return new Promise((resolve) => {
    exec(`reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ${name}`, (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const line = stdout.split(/\r?\n/).find((l) => l.trim().toLowerCase().startsWith(name.toLowerCase()));
      if (!line) return resolve(null);
      const match = line.match(/REG_(?:SZ|DWORD)\s+(.+)$/i);
      resolve(match ? match[1].trim() : null);
    });
  });
}

async function healStaleProxy() {
  // A crashed/force-killed earlier run can leave Windows pointed at our port
  // with nothing listening, which looks like "the whole PC has no internet".
  try {
    const enabled = await readRegistryValue('ProxyEnable');
    if (enabled !== '0x1') return;
    const server = await readRegistryValue('ProxyServer');
    if (!server || !server.includes(PROXY_SERVER)) return;
    const listening = await waitForPort(HTTP_PROXY_PORT, 400);
    if (!listening) {
      logEvent('Detected stale system proxy with no tunnel running; restoring settings');
      setWindowsProxy(false);
    }
  } catch (_) {}
}

// ---- Tunnel engine ---------------------------------------------------------

function waitForPort(port, timeoutMs, shouldAbort) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const attempt = () => {
      if (shouldAbort && shouldAbort()) return resolve(false);
      const socket = net.connect({ host: '127.0.0.1', port });
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        try { socket.destroy(); } catch (_) {}
        if (ok) return resolve(true);
        if (Date.now() - startedAt >= timeoutMs) return resolve(false);
        setTimeout(attempt, 250);
      };
      socket.setTimeout(1000, () => finish(false));
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
    };
    attempt();
  });
}

function probeThroughProxy(timeoutMs = 6000) {
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port: HTTP_PROXY_PORT,
      method: 'CONNECT',
      path: `${PROBE_HOST}:${PROBE_PORT}`,
      timeout: timeoutMs
    });
    let settled = false;
    const finish = (ok, detail) => {
      if (settled) return;
      settled = true;
      try { req.destroy(); } catch (_) {}
      resolve({ ok, detail });
    };
    req.on('connect', (res, socket) => {
      try { socket.destroy(); } catch (_) {}
      finish(res.statusCode >= 200 && res.statusCode < 300, `CONNECT ${PROBE_HOST}:${PROBE_PORT} -> ${res.statusCode}`);
    });
    req.on('timeout', () => finish(false, 'probe timed out'));
    req.on('error', (err) => finish(false, err.message));
    req.end();
  });
}

function prepareRuntimeConfig(sourceConfigPath) {
  try {
    const raw = JSON.parse(fs.readFileSync(sourceConfigPath, 'utf-8'));
    const logDir = getLogDir();
    raw.log = raw.log || {};
    raw.log.loglevel = raw.log.loglevel && raw.log.loglevel !== 'none' ? raw.log.loglevel : 'warning';
    raw.log.error = path.join(logDir, 'xray-error.log');
    const runtimePath = path.join(logDir, 'config.runtime.json');
    fs.writeFileSync(runtimePath, JSON.stringify(raw, null, 2), 'utf-8');
    return { path: runtimePath, error: null };
  } catch (err) {
    return { path: null, error: `The tunnel config could not be read (${err.message}). Re-extract the ChangeIt ZIP.` };
  }
}

function mapSpawnError(err) {
  if (!err) return 'Could not start the tunnel engine.';
  if (err.code === 'ENOENT') {
    return 'Tunnel engine missing: bin\\xray\\xray.exe was not found. Re-extract the full ChangeIt ZIP (do not copy only ChangeIt.exe).';
  }
  if (err.code === 'EACCES' || err.code === 'EPERM') {
    return 'Windows or antivirus blocked xray.exe. Add an exclusion for the ChangeIt folder in Windows Security, then retry.';
  }
  return `Could not start the tunnel engine (${err.code || err.message}).`;
}

function classifyFailure(logTail) {
  const text = (logTail || '').toLowerCase();
  if (text.includes('address already in use') || text.includes('only one usage of each socket') || text.includes('bind:')) {
    return 'Port 10808/10809 is already in use by another VPN/proxy app. Close it (or any second ChangeIt window) and retry.';
  }
  if (text.includes('failed to dial') || text.includes('no such host') || text.includes('i/o timeout') || text.includes('context deadline exceeded')) {
    return 'The tunnel engine could not reach the server. The server domain may be blocked on this network.';
  }
  if (text.includes('failed to start') || text.includes('invalid') || text.includes('infra/conf')) {
    return 'The tunnel engine rejected its configuration. Re-extract the ChangeIt ZIP to restore a clean config.';
  }
  return 'The tunnel engine stopped during startup. See the log for details.';
}

function stopXray(forceAll = false) {
  disconnectRequested = true;
  tunnelActive = false;
  if (xrayProcess) {
    const pid = xrayProcess.pid;
    xrayProcess._changeitIntentional = true;
    try { xrayProcess.kill(); } catch (_) {}
    if (forceAll && pid) {
      // Kill only the tree we launched; never other vendors' xray.exe copies.
      exec(`taskkill /F /T /PID ${pid}`, () => {});
    }
    xrayProcess = null;
  }
}

function spawnXray(exePath, configPath, cwd) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = spawn(exePath, ['run', '-c', configPath], { cwd, windowsHide: true });
    } catch (err) {
      return resolve({ ok: false, error: mapSpawnError(err), detail: err.message });
    }

    xrayProcess = proc;
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const write = (chunk) => appendLog(getXrayLogPath(), chunk.toString());
    if (proc.stdout) proc.stdout.on('data', write);
    if (proc.stderr) proc.stderr.on('data', write);

    proc.on('error', (err) => {
      lastSpawnError = mapSpawnError(err);
      logEvent(`xray spawn error: ${err.code || err.message}`);
      if (xrayProcess === proc) xrayProcess = null;
      settle({ ok: false, error: lastSpawnError, detail: err.message });
    });

    proc.on('exit', (code, signal) => {
      const intentional = proc._changeitIntentional === true || disconnectRequested;
      logEvent(`xray exited (code=${code}, signal=${signal}, intentional=${intentional})`);
      if (xrayProcess === proc) xrayProcess = null;

      if (!settled) {
        const tail = readLogTail(getXrayLogPath());
        settle({ ok: false, error: classifyFailure(tail), detail: tail });
        return;
      }

      const wasActive = tunnelActive;
      tunnelActive = false;
      if (!intentional && wasActive) {
        // Watchdog: the core died after the UI reported "connected".
        setWindowsProxy(false);
        sendToRenderer('vpn:status', {
          status: 'disconnected',
          error: 'The tunnel stopped unexpectedly and your internet settings were restored.'
        });
      }
    });

    // Give the process a moment to fail synchronously (bad exe, AV block).
    setTimeout(() => settle({ ok: true, proc }), 400);
  });
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send(channel, payload);
  }
}

async function startTunnel() {
  const paths = getXrayPaths();
  if (!paths) {
    return {
      status: 'error',
      error: 'Tunnel engine missing: bin\\xray\\xray.exe was not found. Re-extract the full ChangeIt ZIP (do not copy only ChangeIt.exe).'
    };
  }

  if (xrayProcess) stopXray();
  disconnectRequested = false;
  lastSpawnError = null;

  const prepared = prepareRuntimeConfig(paths.configJson);
  if (prepared.error) return { status: 'error', error: prepared.error };

  logEvent(`Starting tunnel: ${paths.xrayExe}`);
  const spawned = await spawnXray(paths.xrayExe, prepared.path, paths.cwd);
  if (!spawned.ok) {
    setWindowsProxy(false);
    return { status: 'error', error: spawned.error, detail: spawned.detail, logPath: getXrayLogPath() };
  }

  const listening = await waitForPort(HTTP_PROXY_PORT, 8000, () => xrayProcess === null);
  if (!listening) {
    const detail = readLogTail(getXrayLogPath());
    const error = lastSpawnError || classifyFailure(detail);
    stopXray();
    setWindowsProxy(false);
    return { status: 'error', error, detail, logPath: getXrayLogPath() };
  }

  let probe = await probeThroughProxy();
  if (!probe.ok) {
    probe = await probeThroughProxy(); // one retry for slow uplinks
  }
  if (!probe.ok) {
    const detail = readLogTail(getXrayLogPath());
    stopXray();
    setWindowsProxy(false);
    return {
      status: 'error',
      error: 'The tunnel engine started but no traffic could pass. The server may be blocked or down on this network.',
      detail: `${probe.detail}\n${detail}`,
      logPath: getXrayLogPath()
    };
  }

  setWindowsProxy(true);
  tunnelActive = true;
  logEvent(`Tunnel verified (${probe.detail}); system proxy enabled`);
  return {
    status: 'connected',
    diagnostics: {
      coreRunning: true,
      httpPort: HTTP_PROXY_PORT,
      socksPort: SOCKS_PROXY_PORT,
      proxy: PROXY_SERVER,
      probe: probe.detail,
      logPath: getXrayLogPath()
    }
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 680,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#0a0d14',
    title: 'ChangeIt',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      backgroundThrottling: false,
    },
  });

  // Intercept the close (X) button to minimize to system tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Silently check for OTA updates 2 seconds after startup
    setTimeout(() => {
      checkForAppUpdates().catch(() => {});
    }, 2000);
  });

  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show ChangeIt',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit ChangeIt',
      click: () => {
        isQuitting = true;
        setWindowsProxy(false);
        stopXray(true);
        setTimeout(() => app.quit(), 300);
      }
    }
  ]);

  tray.setToolTip('ChangeIt - Stealth VPN');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

function getXrayPaths() {
  const exeDir = path.dirname(app.getPath('exe'));
  const possiblePaths = [
    path.join(exeDir, 'bin', 'xray'),
    path.join(process.resourcesPath, '..', 'bin', 'xray'),
    path.join(process.resourcesPath, 'bin', 'xray'),
    path.join(__dirname, '..', 'bin', 'xray'),
    path.join(app.getAppPath(), 'bin', 'xray'),
    path.join(app.getAppPath(), '..', 'bin', 'xray')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'xray.exe'))) {
      const localCfg = path.join(p, 'config.local.json');
      const stdCfg = path.join(p, 'config.json');
      const activeCfg = fs.existsSync(localCfg) ? localCfg : stdCfg;

      return {
        xrayExe: path.join(p, 'xray.exe'),
        configJson: activeCfg,
        cwd: p
      };
    }
  }
  return null;
}

function generateXrayConfig(node) {
  return {
    log: { loglevel: 'none' },
    inbounds: [
      {
        tag: 'socks-in',
        port: 10808,
        listen: '127.0.0.1',
        protocol: 'socks',
        sniffing: { enabled: true, destOverride: ['http', 'tls'] },
        settings: { auth: 'noauth', udp: true }
      },
      {
        tag: 'http-in',
        port: 10809,
        listen: '127.0.0.1',
        protocol: 'http',
        sniffing: { enabled: true, destOverride: ['http', 'tls'] }
      },
      {
        tag: 'ssh-tunnel',
        port: 20091,
        listen: '127.0.0.1',
        protocol: 'dokodemo-door',
        settings: {
          address: '127.0.0.1',
          port: 22,
          network: 'tcp'
        }
      }
    ],
    outbounds: [
      {
        tag: 'proxy',
        protocol: 'vless',
        settings: {
          vnext: [
            {
              address: node.endpoint,
              port: node.port || 443,
              users: [
                {
                  id: node.uuid || '',
                  encryption: 'none',
                  level: 0
                }
              ]
            }
          ]
        },
        streamSettings: {
          network: 'ws',
          security: 'tls',
          wsSettings: {
            path: node.path || '/tunnel'
          }
        }
      },
      {
        tag: 'direct',
        protocol: 'freedom'
      }
    ],
    routing: {
      domainStrategy: 'IPIfNonMatch',
      rules: [
        {
          type: 'field',
          inboundTag: ['ssh-tunnel'],
          outboundTag: 'proxy'
        },
        {
          type: 'field',
          port: '22,2222',
          outboundTag: 'direct'
        },
        {
          type: 'field',
          ip: [
            '10.0.0.0/8',
            '172.16.0.0/12',
            '192.168.0.0/16',
            '127.0.0.0/8'
          ],
          outboundTag: 'direct'
        }
      ]
    }
  };
}

async function fetchRemoteNodes() {
  return new Promise((resolve) => {
    const configUrl = getRemoteConfigUrl();
    if (!configUrl) return resolve(null);

    const req = https.get(configUrl, { timeout: 4000 }, (res) => {
      if (res.statusCode !== 200) return resolve(null);
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
            const paths = getXrayPaths();
            if (paths) {
              const activeNode = parsed.nodes[0];
              const generatedCfg = generateXrayConfig(activeNode);
              const localCfgPath = path.join(paths.cwd, 'config.local.json');
              fs.writeFileSync(localCfgPath, JSON.stringify(generatedCfg, null, 2), 'utf-8');
            }
            return resolve(parsed.nodes);
          }
        } catch (e) {
          // ignore
        }
        resolve(null);
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    function get(targetUrl) {
      const client = targetUrl.startsWith('https') ? https : http;
      client.get(targetUrl, {
        headers: {
          'User-Agent': 'ChangeIt-Desktop-Updater'
        }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download HTTP ${res.statusCode}`));
        }

        const prevNoAsar = process.noAsar;
        process.noAsar = true;
        const fileStream = fs.createWriteStream(destPath);
        process.noAsar = prevNoAsar;

        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close(() => resolve(destPath));
        });
      }).on('error', (err) => {
        try { 
          const prev = process.noAsar;
          process.noAsar = true;
          fs.unlinkSync(destPath); 
          process.noAsar = prev;
        } catch (_) {}
        reject(err);
      });
    }
    get(url);
  });
}

function isNewerVersion(remoteTag, localVer) {
  const r = (remoteTag || '').replace(/^v/, '').split('.').map(Number);
  const l = (localVer || '').replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const remotePart = r[i] || 0;
    const localPart = l[i] || 0;
    if (remotePart > localPart) return true;
    if (remotePart < localPart) return false;
  }
  return false;
}

async function checkForAppUpdates() {
  try {
    let currentVersion = '1.3.4';
    try {
      const pkg = require(path.join(__dirname, '../package.json'));
      if (pkg.version) currentVersion = pkg.version;
    } catch (_) {}

    const releaseApiUrl = 'https://api.github.com/repos/hariharanboss/changeit-vpn/releases/latest';

    https.get(releaseApiUrl, {
      headers: {
        'User-Agent': 'ChangeIt-Desktop-Updater',
        'Accept': 'application/vnd.github.v3+json'
      }
    }, (res) => {
      if (res.statusCode !== 200) return;
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', async () => {
        try {
          const release = JSON.parse(rawData);
          const remoteTag = release.tag_name || '';
          if (isNewerVersion(remoteTag, currentVersion)) {
            const asarAsset = (release.assets || []).find(a => a.name === 'app.asar');
            if (asarAsset && asarAsset.browser_download_url) {
              // Save with non-asar extension so Electron does not attempt virtual fs parsing
              const tempUpdate = path.join(os.tmpdir(), `changeit_update_${remoteTag}.pkg`);
              await downloadFile(asarAsset.browser_download_url, tempUpdate);
              
              const prev = process.noAsar;
              process.noAsar = true;
              const exists = fs.existsSync(tempUpdate);
              const validSize = exists && fs.statSync(tempUpdate).size > 50000;
              process.noAsar = prev;

              if (validSize) {
                updateDownloadedPath = tempUpdate;
                newVersionAvailable = remoteTag.replace(/^v/, '');
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('updater:ready', {
                    version: newVersionAvailable,
                    notes: release.body || ''
                  });
                }
              }
            }
          }
        } catch (_) {}
      });
    }).on('error', () => {});
  } catch (_) {}
}

ipcMain.handle('updater:get-status', () => {
  return {
    ready: !!updateDownloadedPath,
    version: newVersionAvailable
  };
});

ipcMain.handle('updater:check-now', async () => {
  await checkForAppUpdates();
  return {
    ready: !!updateDownloadedPath,
    version: newVersionAvailable
  };
});

ipcMain.handle('updater:apply', () => {
  const prev = process.noAsar;
  process.noAsar = true;
  const hasUpdate = updateDownloadedPath && fs.existsSync(updateDownloadedPath);
  process.noAsar = prev;

  if (!hasUpdate) {
    return { success: false, error: 'No update ready' };
  }

  isQuitting = true;
  // Never apply an update while the system proxy still points at a core we
  // are about to orphan; that is what leaves a machine with no internet.
  setWindowsProxy(false);
  stopXray();
  const targetAsar = path.join(process.resourcesPath, 'app.asar');
  const batPath = path.join(os.tmpdir(), 'changeit_apply.bat');
  const batContent = `@echo off\r\ntimeout /t 1 /nobreak >nul\r\ncopy /Y "${updateDownloadedPath}" "${targetAsar}"\r\ndel "${updateDownloadedPath}"\r\nstart "" "${process.execPath}"\r\ndel "%~f0"\r\n`;

  fs.writeFileSync(batPath, batContent);
  spawn('cmd.exe', ['/c', batPath], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  setTimeout(() => app.exit(0), 500);
  return { success: true };
});

ipcMain.handle('vpn:fetch-nodes', async () => {
  return fetchRemoteNodes();
});

ipcMain.handle('vpn:connect', async () => {
  try {
    return await startTunnel();
  } catch (err) {
    logEvent(`connect failed: ${err.message}`);
    stopXray();
    setWindowsProxy(false);
    return { status: 'error', error: `Unexpected error: ${err.message}`, logPath: getXrayLogPath() };
  }
});

ipcMain.handle('vpn:disconnect', async () => {
  setWindowsProxy(false);
  stopXray(true);
  return { status: 'disconnected' };
});

ipcMain.handle('vpn:diagnose', async () => {
  const listening = await waitForPort(HTTP_PROXY_PORT, 600);
  const probe = listening ? await probeThroughProxy(4000) : { ok: false, detail: 'Proxy port is not listening' };
  return {
    coreRunning: tunnelActive && !!xrayProcess,
    listening,
    probeOk: probe.ok,
    probe: probe.detail,
    proxy: PROXY_SERVER,
    logPath: getXrayLogPath()
  };
});

ipcMain.handle('vpn:open-logs', () => {
  try { shell.openPath(getLogDir()); } catch (_) {}
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();
    healStaleProxy();
    fetchRemoteNodes();
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  setWindowsProxy(false);
  stopXray(true);
  if (tray) {
    try { tray.destroy(); } catch (_) {}
  }
});

app.on('window-all-closed', () => {
  // Stay running in the system tray in background
});
