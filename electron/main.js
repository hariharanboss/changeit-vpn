const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

let mainWindow;
let xrayProcess = null;

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
    width: 1100,
    height: 750,
    backgroundColor: '#0b0e14',
    title: 'OpenTunnel Desktop',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  const indexPath = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(indexPath);
}

// Find xray.exe accurately across dev and packaged modes
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
      return {
        xrayExe: path.join(p, 'xray.exe'),
        configJson: path.join(p, 'config.json'),
        cwd: p
      };
    }
  }
  return null;
}

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

      xrayProcess.on('error', (err) => {
        if (mainWindow) mainWindow.webContents.send('vpn:log', `Spawn error: ${err.message}`);
      });

      xrayProcess.stdout.on('data', (data) => {
        if (mainWindow) mainWindow.webContents.send('vpn:log', data.toString());
      });

      xrayProcess.stderr.on('data', (data) => {
        if (mainWindow) mainWindow.webContents.send('vpn:log', data.toString());
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

app.whenReady().then(createWindow);

app.on('will-quit', () => {
  setWindowsProxy(false);
  if (xrayProcess) xrayProcess.kill();
  exec('taskkill /F /IM xray.exe /T');
});

app.on('window-all-closed', () => {
  setWindowsProxy(false);
  if (process.platform !== 'darwin') app.quit();
});
