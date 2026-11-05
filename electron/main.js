const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');

let mainWindow;
let xrayProcess = null;

function setWindowsProxy(enable) {
  if (enable) {
    // Enable system proxy to localhost:10809 (HTTP) and localhost:10808 (SOCKS)
    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f');
    exec('reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:10809" /f');
  } else {
    // Disable system proxy
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

// IPC Handlers for Connection
ipcMain.handle('vpn:connect', async () => {
  return new Promise((resolve) => {
    try {
      const xrayPath = path.join(__dirname, '../bin/xray/xray.exe');
      const configPath = path.join(__dirname, '../bin/xray/config.json');

      // Spawn native Xray process
      xrayProcess = spawn(xrayPath, ['run', '-c', configPath], {
        cwd: path.dirname(xrayPath),
        windowsHide: true,
      });

      xrayProcess.stdout.on('data', (data) => {
        if (mainWindow) mainWindow.webContents.send('vpn:log', data.toString());
      });

      xrayProcess.stderr.on('data', (data) => {
        if (mainWindow) mainWindow.webContents.send('vpn:log', data.toString());
      });

      // Turn on Windows system proxy
      setWindowsProxy(true);
      resolve({ status: 'connected' });
    } catch (err) {
      resolve({ status: 'error', error: err.message });
    }
  });
});

ipcMain.handle('vpn:disconnect', async () => {
  return new Promise((resolve) => {
    // Turn off Windows system proxy
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
