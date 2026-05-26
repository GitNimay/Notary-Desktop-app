const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const http = require('http');
const https = require('https');
const path = require('path');

const APP_NAME = 'NotaryXpert';
const APP_ID = 'com.notaryxpert.desktop';
const isDev = !app.isPackaged;
let downloadedUpdateInfo = null;

app.setName(APP_NAME);

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

const ALLOWED_RD_PORTS = new Set([
  ...Array.from({ length: 21 }, (_, index) => String(11100 + index)),
  ...Array.from({ length: 6 }, (_, index) => String(8000 + index)),
]);
const ALLOWED_RD_HOSTS = new Set(['127.0.0.1', 'localhost']);

function isAllowedRdUrl(url) {
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    ALLOWED_RD_HOSTS.has(url.hostname) &&
    ALLOWED_RD_PORTS.has(url.port)
  );
}

function requestLocalRdService({ url, method = 'GET', headers = {}, body = '', timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    if (!isAllowedRdUrl(parsedUrl)) {
      reject(new Error(`Blocked non-local RD service URL: ${url}`));
      return;
    }

    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const requestBody = body ? Buffer.from(body, 'utf8') : null;
    const requestHeaders = { ...headers };

    if (requestBody && !requestHeaders['Content-Length'] && !requestHeaders['content-length']) {
      requestHeaders['Content-Length'] = String(requestBody.byteLength);
    }

    const request = transport.request(
      parsedUrl,
      {
        method,
        headers: requestHeaders,
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      (response) => {
        const chunks = [];

        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            ok: response.statusCode >= 200 && response.statusCode < 300,
            status: response.statusCode,
            statusText: response.statusMessage,
            headers: response.headers,
            text: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error(`RD service request timed out after ${timeoutMs}ms.`));
    });

    request.on('error', (error) => {
      resolve({
        ok: false,
        status: 0,
        statusText: error.code || error.message || 'RD service request failed',
        headers: {},
        text: '',
      });
    });

    if (requestBody) {
      request.write(requestBody);
    }

    request.end();
  });
}

ipcMain.handle('rd-service:request', async (event, args) => {
  try {
    return await requestLocalRdService(args);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: error instanceof Error ? error.message : 'RD service request failed',
      headers: {},
      text: '',
    };
  }
});

ipcMain.handle('updater:get-downloaded-update', async () => downloadedUpdateInfo);

ipcMain.handle('updater:restart-and-install', async () => {
  if (!downloadedUpdateInfo || !app.isPackaged) {
    return { ok: false, message: 'No downloaded update is ready to install.' };
  }

  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
});

function notifyUpdateDownloaded(updateInfo) {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('updater:update-downloaded', updateInfo);
    }
  });
}

function createMainWindow() {
  const iconPath = path.join(__dirname, '..', isDev ? 'public' : 'dist', 'notaryxpert-favicon.png');
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    title: APP_NAME,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

function setupAutoUpdates() {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on('update-downloaded', (event) => {
    downloadedUpdateInfo = {
      version: event.version,
      releaseDate: event.releaseDate,
    };
    notifyUpdateDownloaded(downloadedUpdateInfo);
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto-update failed:', error);
  });

  autoUpdater.checkForUpdates().catch((error) => {
    console.error('Auto-update check failed:', error);
  });
}

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev && (url.startsWith('https://localhost:3000') || url.startsWith('https://127.0.0.1:3000'))) {
    event.preventDefault();
    callback(true);
    return;
  }

  callback(false);
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createMainWindow();
  setupAutoUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
