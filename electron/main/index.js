/**
 * Electron Main Process – Tawlaty Desktop
 * Security: contextIsolation=true, nodeIntegration=false, sandbox enabled
 */
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const isDev = !app.isPackaged;

/** Web app URL – loaded as webview in both dev and production */
const APP_URL = process.env.APP_URL || 'https://app.tawlaty.com';

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;

/*───────────────────────────────────────────────────────────────────────────*
 * IPC Module Imports (split by domain for maintainability)
 *───────────────────────────────────────────────────────────────────────────*/
const { register: registerSettings, settingsStore } = require('./ipc/settings');
const printersIpc = require('./ipc/printers');
const { initializeUpdater, checkForUpdates } = require('./updater');
const { isSameOrigin, guardIpcMain } = require('./security');
// const serialIpc = require('./ipc/serial'); // enable when ready

/*───────────────────────────────────────────────────────────────────────────*
 * App Lifecycle
 *───────────────────────────────────────────────────────────────────────────*/

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();
  createAppMenu();
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

// Defence in depth for every webContents (main window + hidden print windows):
// no <webview> embedding and no popups.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (e) => e.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
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

  // Load web app as webview (same URL in dev and production)
  mainWindow.loadURL(APP_URL);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Prevent external navigation for security (exact origin, not a string prefix)
  const blockForeignNavigation = (e, url) => {
    if (!isSameOrigin(url, APP_URL)) {
      console.warn(`[security] Blocked navigation to ${url}`);
      e.preventDefault();
    }
  };
  mainWindow.webContents.on('will-navigate', blockForeignNavigation);
  mainWindow.webContents.on('will-redirect', blockForeignNavigation);

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/*───────────────────────────────────────────────────────────────────────────*
 * Tray
 *───────────────────────────────────────────────────────────────────────────*/

function createAppMenu() {
  const template = [
    {
      label: 'Tawlaty',
      submenu: [
        { label: `Version ${app.getVersion()}`, enabled: false },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: `Version: ${app.getVersion()}`,
          enabled: false,
        },
        { type: 'separator' },
        {
          label: 'Check for Updates...',
          click: () => checkForUpdates(mainWindow),
        },
        { type: 'separator' },
        {
          label: 'About Tawlaty',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Tawlaty',
              message: 'Tawlaty POS',
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nChromium: ${process.versions.chrome}`,
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/tray.png');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('Tawlaty');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Check for Updates', click: () => checkForUpdates(mainWindow) },
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
  // Every handler rejects calls whose sender frame is not on the APP_URL origin.
  const trustedIpcMain = guardIpcMain(ipcMain, APP_URL);

  registerSettings(trustedIpcMain, app);
  printersIpc.register(trustedIpcMain, settingsStore);

  // Handle manual update check from renderer
  trustedIpcMain.handle('check-for-updates', () => {
    checkForUpdates(mainWindow);
  });
}
