const { app, BrowserWindow, shell } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEV_URL = process.env.TWITCANVA_APP_URL || 'http://127.0.0.1:5173';
const SERVER_PORT = Number(process.env.TWITCANVA_SERVER_PORT || process.env.PORT || 3001);
const isDev = !app.isPackaged;

let mainWindow = null;
let serverProcess = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForUrl(url, retries = 80) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_) {}
    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function resolveServerEntry() {
  if (isDev) {
    return path.join(process.cwd(), 'server', 'index.js');
  }
  const packagedEntry = path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'index.js');
  return fs.existsSync(packagedEntry)
    ? packagedEntry
    : path.join(process.resourcesPath, 'app.asar', 'server', 'index.js');
}

function buildServerEnv() {
  return {
    ...process.env,
    PORT: String(SERVER_PORT),
    TWITCANVA_SERVER_PORT: String(SERVER_PORT),
    TWITCANVA_LIBRARY_DIR: path.join(app.getPath('userData'), 'library'),
    NODE_ENV: 'production',
  };
}

async function ensureServer() {
  if (isDev || serverProcess) return;
  const serverEntry = resolveServerEntry();
  serverProcess = fork(serverEntry, [], {
    cwd: path.dirname(serverEntry),
    env: buildServerEnv(),
    stdio: 'ignore',
  });

  await waitForUrl(`http://127.0.0.1:${SERVER_PORT}/api/openaiteach/ping`, 120);
  await waitForUrl(`http://127.0.0.1:${SERVER_PORT}`, 120);
}

async function createWindow() {
  await ensureServer();

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1280,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    await waitForUrl(DEV_URL, 120);
    await mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}`);
  }
}

async function bootstrapWindow() {
  try {
    await createWindow();
  } catch (error) {
    console.error('[desktop] Failed to bootstrap Electron runtime:', error);
    app.quit();
  }
}

app.whenReady().then(() => {
  void bootstrapWindow();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void bootstrapWindow();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
