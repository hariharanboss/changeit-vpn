const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const https = require('https');

let mainWindow;
let xrayProcess = null;

// Admin Remote Config URL (Secret Gist)
// Obfuscated endpoint sync buffer
const REMOTE_CONFIG_URL = Buffer.from('aHR0cHM6Ly9naXN0LmdpdGh1YnVzZXJjb250ZW50LmNvbS9oYXJpaGFyYW5ib3NzLzE1MjIzZWExZWQwZDRiZjk3ZDE2ZDIzNjU3NzdhOWJlL3Jhdy9vcGVudHVubmVsX25vZGVzLmpzb24=', 'base64').toString('utf-8');

function setWindowsProxy(enable) {
  if (enable) {
    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f');
    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:10809" /f');
  } else {
    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    resizable: false,        // Disables window resizing
    maximizable: false,      // Disables the maximize/fullscreen button
    fullscreenable: false,   // Disables fullscreen mode
    backgroundColor: '#0a0d14',
    title: 'ChangeIt',
    autoHideMenuBar: true,
    show: false,             // Prevents white flash and displays instantly when ready
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);
}

function getXrayPaths() {
  const possiblePaths = [
    path.join(__dirname, '../bin/xray'),
    path.join(process.resourcesPath, 'app/bin/xray'),
    path.join(process.resourcesPath, 'bin/xray'),
    path.join(app.getAppPath(), 'bin/xray'),
    'C:\\Users\\dhanusha\\.gemini\\antigravity\\scratch\\opentunnel-desktop\\bin\\xray'
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
    ]
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
  // Fetch remote node configuration in background
  fetchRemoteNodes();
});

app.on('will-quit', () => {
  setWindowsProxy(false);
  if (xrayProcess) xrayProcess.kill();
  exec('taskkill /F /IM xray.exe /T');
});

app.on('window-all-closed', () => {
  setWindowsProxy(false);
  if (process.platform !== 'darwin') app.quit();
});
