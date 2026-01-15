/**
 * Electron Main Process – BaristaFlow Desktop
 * Security: contextIsolation=true, nodeIntegration=false, sandbox enabled
 */
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');

// Handle Squirrel Windows installer events
if (require('electron-squirrel-startup')) app.quit();

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const isDev = !app.isPackaged;

/** Vite dev server URL (set VITE_DEV_SERVER_URL in .env or default to 5173) */
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'https://app.baristaflow.com/';

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;

/*───────────────────────────────────────────────────────────────────────────*
 * IPC Module Imports (split by domain for maintainability)
 *───────────────────────────────────────────────────────────────────────────*/
const { register: registerSettings, settingsStore } = require('./ipc/settings');
const printersIpc = require('./ipc/printers');
const sqliteIpc = require('./ipc/sqlite');
const { initializeUpdater } = require('./updater');
// const serialIpc = require('./ipc/serial'); // enable when ready

/*───────────────────────────────────────────────────────────────────────────*
 * App Lifecycle
 *───────────────────────────────────────────────────────────────────────────*/

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();
  createTray();
  
  // Initialize auto-updater after window is created
  initializeUpdater(mainWindow);

  app.on('activate', () => {
    // macOS dock re-open
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/*───────────────────────────────────────────────────────────────────────────*
 * Window Factory
 *───────────────────────────────────────────────────────────────────────────*/

function createMainWindow() {
  const iconPath = path.join(__dirname, '../../assets/logo.ico');
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Graceful show after ready
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Load renderer
  if (isDev) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load built Frontend assets from extraResource
    const rendererPath = path.join(process.resourcesPath, 'dist', 'index.html');
    mainWindow.loadFile(rendererPath);
  }

  // Prevent external navigation for security
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(VITE_DEV_SERVER_URL) && !url.startsWith('file://')) {
      e.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/*───────────────────────────────────────────────────────────────────────────*
 * Tray
 *───────────────────────────────────────────────────────────────────────────*/

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('BaristaFlow');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

/*───────────────────────────────────────────────────────────────────────────*
 * IPC Registration (whitelisted handlers only)
 *───────────────────────────────────────────────────────────────────────────*/

function registerIpcHandlers() {
  registerSettings(ipcMain, app);
  printersIpc.register(ipcMain, settingsStore);
  sqliteIpc.register(ipcMain, app);
}
