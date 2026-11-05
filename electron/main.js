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
    width: 1040,
    height: 720,
    resizable: false,        // Disables window resizing
    maximizable: false,      // Disables the maximize/fullscreen button
    fullscreenable: false,   // Disables fullscreen mode
    backgroundColor: '#0a0d14',
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
