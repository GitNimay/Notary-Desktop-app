const { app, BrowserWindow, ipcMain, shell } = require('electron');
const http = require('http');
const https = require('https');
const path = require('path');

const isDev = !app.isPackaged;
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

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: 'NotaryXpert',
    icon: path.join(__dirname, '..', 'public', 'notaryxpert-favicon.png'),
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

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev && (url.startsWith('https://localhost:3000') || url.startsWith('https://127.0.0.1:3000'))) {
    event.preventDefault();
    callback(true);
    return;
  }

  callback(false);
});

app.whenReady().then(() => {
  createMainWindow();

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
