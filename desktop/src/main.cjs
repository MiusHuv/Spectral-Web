const { app, BrowserWindow, Menu, dialog, ipcMain, safeStorage, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

let mainWindow;
let settingsWindow;
let backendProcess;
let frontendServer;
let frontendPort;
let backendPort;
let sessionPassword = '';
let starting = false;
let quitting = false;

const defaultSettings = {
  host: '127.0.0.1',
  port: 3306,
  name: 'asteroid_spectral_db',
  user: 'root',
  password: ''
};

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readStoredSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function decryptPassword(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return '';
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return '';
  }
}

function configuredEngine() {
  return String(
    process.env.SPECTRAL_DB_ENGINE || readStoredSettings().engine || 'sqlite'
  ).toLowerCase();
}

function loadSettings() {
  const stored = readStoredSettings();
  const engine = configuredEngine();

  return {
    engine,
    path: process.env.SPECTRAL_DB_PATH || embeddedDatabasePath(),
    host: process.env.SPECTRAL_DB_HOST || stored.host || defaultSettings.host,
    port: Number(process.env.SPECTRAL_DB_PORT || stored.port || defaultSettings.port),
    name: process.env.SPECTRAL_DB_NAME || stored.name || defaultSettings.name,
    user: process.env.SPECTRAL_DB_USER || stored.user || defaultSettings.user,
    password: process.env.SPECTRAL_DB_PASSWORD || sessionPassword || decryptPassword(stored.passwordEncrypted)
  };
}

function settingsAreReady() {
  if (configuredEngine() === 'sqlite') {
    return true;
  }
  const hasEnvironmentConfig = Object.keys(process.env)
    .some((key) => key.startsWith('SPECTRAL_DB_'));
  if (hasEnvironmentConfig) return true;
  const stored = readStoredSettings();
  return stored.configured === true && stored.passwordRequired !== true;
}

function saveSettings(settings) {
  const normalized = {
    host: String(settings.host || '').trim(),
    port: Number(settings.port),
    name: String(settings.name || '').trim(),
    user: String(settings.user || '').trim(),
    password: String(settings.password || '')
  };

  if (!normalized.host || !normalized.name || !normalized.user) {
    throw new Error('Host, database name, and user are required.');
  }
  if (!Number.isInteger(normalized.port) || normalized.port < 1 || normalized.port > 65535) {
    throw new Error('Port must be an integer between 1 and 65535.');
  }

  sessionPassword = normalized.password;
  const persisted = {
    engine: 'mysql',
    host: normalized.host,
    port: normalized.port,
    name: normalized.name,
    user: normalized.user,
    configured: true,
    passwordRequired: Boolean(normalized.password && !safeStorage.isEncryptionAvailable())
  };
  if (normalized.password && safeStorage.isEncryptionAvailable()) {
    persisted.passwordEncrypted = safeStorage.encryptString(normalized.password).toString('base64');
  }

  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), `${JSON.stringify(persisted, null, 2)}\n`, { mode: 0o600 });
  return normalized;
}

function useEmbeddedDatabase() {
  if (process.env.SPECTRAL_DB_ENGINE) {
    dialog.showErrorBox(
      'Database mode is managed externally',
      'SPECTRAL_DB_ENGINE is set in the environment and cannot be changed from the application menu.'
    );
    return;
  }
  const persisted = { ...readStoredSettings(), engine: 'sqlite' };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), `${JSON.stringify(persisted, null, 2)}\n`, { mode: 0o600 });
  setImmediate(startApplication);
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function backendExecutable() {
  if (!app.isPackaged) {
    return {
      command: process.platform === 'win32' ? 'python' : 'python3',
      args: [path.join(__dirname, '../../backend/desktop_entry.py')]
    };
  }
  const filename = process.platform === 'win32' ? 'spectral-backend.exe' : 'spectral-backend';
  return { command: path.join(process.resourcesPath, 'backend', filename), args: [] };
}

function embeddedDatabasePath() {
  if (!app.isPackaged) {
    return path.join(__dirname, '../data/spectral.sqlite3');
  }
  return path.join(process.resourcesPath, 'data', 'spectral.sqlite3');
}

function logBackend(data) {
  const logFile = path.join(app.getPath('userData'), 'backend.log');
  fs.appendFileSync(logFile, data);
}

function startBackend(settings) {
  const executable = backendExecutable();
  if (settings.engine === 'sqlite' && !fs.existsSync(settings.path)) {
    throw new Error(`Bundled SQLite database is missing: ${settings.path}`);
  }
  const env = {
    ...process.env,
    FLASK_ENV: 'desktop',
    DB_ENGINE: settings.engine,
    DB_PATH: settings.path,
    DB_HOST: settings.host,
    DB_PORT: String(settings.port),
    DB_NAME: settings.name,
    DB_USER: settings.user,
    DB_PASSWORD: settings.password,
    CACHE_TYPE: 'simple',
    SPECTRAL_BACKEND_PORT: String(backendPort)
  };

  backendProcess = spawn(executable.command, executable.args, {
    cwd: app.getPath('userData'),
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  backendProcess.stdout.on('data', logBackend);
  backendProcess.stderr.on('data', logBackend);
  backendProcess.on('error', (error) => logBackend(`Backend process error: ${error.stack || error}\n`));
}

async function waitForBackend(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (backendProcess && backendProcess.exitCode !== null) {
      throw new Error(`Backend exited with code ${backendProcess.exitCode}.`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${backendPort}/health`);
      if (response.ok) return;
    } catch {
      // The sidecar may still be importing scientific Python packages.
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error('Backend did not become ready within 20 seconds.');
}

function frontendRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'frontend')
    : path.join(__dirname, '../../frontend/dist');
}

function contentType(filePath) {
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function proxyRequest(request, response) {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: backendPort,
    path: request.url,
    method: request.method,
    headers: { ...request.headers, host: `127.0.0.1:${backendPort}` }
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Local API is unavailable' }));
  });
  request.pipe(upstream);
}

function startFrontendServer() {
  const root = frontendRoot();
  frontendServer = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, `http://127.0.0.1:${frontendPort}`);
    if (requestUrl.pathname === '/api' || requestUrl.pathname.startsWith('/api/') || requestUrl.pathname === '/health') {
      proxyRequest(request, response);
      return;
    }

    let relativePath;
    try {
      relativePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
    } catch {
      response.writeHead(400);
      response.end('Bad request');
      return;
    }
    const candidate = path.resolve(root, relativePath || 'index.html');
    const rootPrefix = `${path.resolve(root)}${path.sep}`;
    if (candidate !== path.resolve(root, 'index.html') && !candidate.startsWith(rootPrefix)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const filePath = fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? candidate
      : path.join(root, 'index.html');
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': contentType(filePath),
        'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
        'Content-Security-Policy': "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
      });
      response.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    frontendServer.once('error', reject);
    frontendServer.listen(frontendPort, '127.0.0.1', resolve);
  });
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(`http://127.0.0.1:${frontendPort}`);
    mainWindow.show();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#f6f8fa',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadURL(`http://127.0.0.1:${frontendPort}`);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${frontendPort}`)) event.preventDefault();
  });
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 650,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow || undefined,
    modal: Boolean(mainWindow),
    title: 'Database Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, '../settings/index.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = undefined;
    if (!mainWindow && !quitting) app.quit();
  });
}

async function stopServices() {
  if (frontendServer) {
    await new Promise((resolve) => frontendServer.close(resolve));
    frontendServer = undefined;
  }
  if (backendProcess && backendProcess.exitCode === null) {
    backendProcess.kill();
  }
  backendProcess = undefined;
}

async function startApplication() {
  if (starting) return;
  starting = true;
  try {
    await stopServices();
    backendPort = await findFreePort();
    frontendPort = await findFreePort();
    const settings = loadSettings();
    startBackend(settings);
    await waitForBackend();
    await startFrontendServer();
    createMainWindow();
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.close();
  } catch (error) {
    logBackend(`Startup failure: ${error.stack || error}\n`);
    const sqliteMode = configuredEngine() === 'sqlite';
    dialog.showErrorBox(
      'Spectral Web could not start',
      sqliteMode
        ? 'The embedded spectral database is missing or could not be opened. Reinstall the complete application package. Detailed diagnostics were written to backend.log in the application data directory.'
        : 'The configured MySQL server could not be reached or rejected the credentials. Check Database Settings, then try again. Detailed diagnostics were written to backend.log in the application data directory.'
    );
    if (!sqliteMode) openSettings();
  } finally {
    starting = false;
  }
}

function installMenu() {
  const template = [{
    label: process.platform === 'darwin' ? app.name : 'File',
    submenu: [
      {
        label: 'Database',
        submenu: [
          { label: 'Use Embedded Database', click: useEmbeddedDatabase },
          { label: 'Connect to External MySQL...', click: openSettings }
        ]
      },
      { type: 'separator' },
      process.platform === 'darwin' ? { role: 'quit' } : { role: 'close' }
    ]
  }, {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'togglefullscreen' }
    ]
  }];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('settings:get', () => {
  const settings = loadSettings();
  return { ...settings, encryptionAvailable: safeStorage.isEncryptionAvailable() };
});

ipcMain.handle('settings:save', async (_event, settings) => {
  try {
    saveSettings(settings);
    setImmediate(startApplication);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

ipcMain.on('settings:cancel', () => settingsWindow && settingsWindow.close());

app.whenReady().then(async () => {
  installMenu();
  if (!settingsAreReady()) {
    openSettings();
  } else {
    await startApplication();
  }
  app.on('activate', () => {
    if (!mainWindow) startApplication();
  });
});

app.on('before-quit', () => {
  quitting = true;
  if (backendProcess && backendProcess.exitCode === null) backendProcess.kill();
  if (frontendServer) frontendServer.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
