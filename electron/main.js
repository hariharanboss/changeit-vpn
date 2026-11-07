const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');
const os = require('os');

// Prevent unexpected electron dialogs on background tasks
process.on('uncaughtException', (err) => {
  console.error('ChangeIt Main Exception:', err);
});

let mainWindow;
let tray = null;
let isQuitting = false;
let xrayProcess = null;
let updateDownloadedPath = null;
let newVersionAvailable = null;

// Admin Remote Config URL (Secret Gist)
// Obfuscated endpoint sync buffer
const REMOTE_CONFIG_URL = Buffer.from('aHR0cHM6Ly9naXN0LmdpdGh1YnVzZXJjb250ZW50LmNvbS9oYXJpaGFyYW5ib3NzLzE1MjIzZWExZWQwZDRiZjk3ZDE2ZDIzNjU3NzdhOWJlL3Jhdy9vcGVudHVubmVsX25vZGVzLmpzb24=', 'base64').toString('utf-8');

function getBypassIps() {
  const defaultIps = ['135.125.222.22', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8'];
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

function setWindowsProxy(enable) {
  if (enable) {
    const overrideList = '<local>;localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;172.20.*;172.21.*;172.22.*;172.23.*;172.24.*;172.25.*;172.26.*;172.27.*;172.28.*;172.29.*;172.30.*;172.31.*;192.168.*;135.125.222.22';
    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f');
    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:10809" /f');
    exec(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyOverride /t REG_SZ /d "${overrideList}" /f`);
  } else {
    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f');
  }
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
        if (xrayProcess) {
          xrayProcess.kill();
          xrayProcess = null;
        }
        exec('taskkill /F /IM xray.exe /T', () => {
          app.quit();
        });
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
    const req = https.get(REMOTE_CONFIG_URL, { timeout: 4000 }, (res) => {
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
  const targetAsar = path.join(process.resourcesPath, 'app.asar');
  const batPath = path.join(os.tmpdir(), 'changeit_apply.bat');
  const batContent = `@echo off\r\ntimeout /t 1 /nobreak >nul\r\ncopy /Y "${updateDownloadedPath}" "${targetAsar}"\r\ndel "${updateDownloadedPath}"\r\nstart "" "${process.execPath}"\r\ndel "%~f0"\r\n`;

  fs.writeFileSync(batPath, batContent);
  spawn('cmd.exe', ['/c', batPath], {
    detached: true,
    stdio: 'ignore'
  }).unref();

  app.exit(0);
  return { success: true };
});

ipcMain.handle('vpn:fetch-nodes', async () => {
  return fetchRemoteNodes();
});

ipcMain.handle('vpn:connect', async () => {
  return new Promise((resolve) => {
    try {
      const paths = getXrayPaths();
      if (!paths) {
        return resolve({ status: 'error', error: 'xray.exe not found' });
      }

      xrayProcess = spawn(paths.xrayExe, ['run', '-c', paths.configJson], {
        cwd: paths.cwd,
        windowsHide: true,
      });

      setWindowsProxy(true);
      resolve({ status: 'connected' });
    } catch (err) {
      resolve({ status: 'error', error: err.message });
    }
  });
});

ipcMain.handle('vpn:disconnect', async () => {
  return new Promise((resolve) => {
    setWindowsProxy(false);
    if (xrayProcess) {
      xrayProcess.kill();
      xrayProcess = null;
    }
    exec('taskkill /F /IM xray.exe /T', () => {
      resolve({ status: 'disconnected' });
    });
  });
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  fetchRemoteNodes();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  setWindowsProxy(false);
  if (xrayProcess) xrayProcess.kill();
  exec('taskkill /F /IM xray.exe /T');
  if (tray) {
    try { tray.destroy(); } catch (_) {}
  }
});

app.on('window-all-closed', () => {
  // Stay running in the system tray in background
});
