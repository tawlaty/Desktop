/**
 * Auto-Updater Module - GitHub Releases Integration (tawlaty/Desktop, public)
 *
 * Updates download silently in the background and install on quit. When a
 * download finishes the user gets one non-blocking "restart now / later"
 * prompt; "Later" simply installs on the next quit. We never force a restart.
 */
const { autoUpdater } = require('electron-updater');
const { dialog, app } = require('electron');

const FIRST_CHECK_DELAY_MS = 3 * 1000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow = null;
let initialized = false;
let manualCheckPending = false;
let restartPromptOpen = false;

function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

/**
 * Silent background check (startup + interval). Errors are logged only.
 */
function backgroundCheck() {
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Update check failed:', err.message);
  });
}

/**
 * One non-blocking prompt once an update is downloaded. Intentionally not
 * parented to the main window so the cashier can keep working while it is open.
 */
function promptRestart(info) {
  if (restartPromptOpen) return;
  restartPromptOpen = true;

  dialog
    .showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: `Version ${info.version} is ready to install.`,
      detail: 'Restart now, or choose Later to install it the next time the app closes.',
      buttons: ['Restart now', 'Later'],
      defaultId: 1,
      cancelId: 1,
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    })
    .catch((err) => console.error('Update prompt failed:', err))
    .finally(() => {
      restartPromptOpen = false;
    });
}

/**
 * Initialize the auto-updater
 * @param {BrowserWindow} window - The main application window
 */
function initializeUpdater(window) {
  mainWindow = window;

  if (!app.isPackaged) {
    console.log('Auto-updater disabled in development mode');
    return;
  }
  if (initialized) return;
  initialized = true;

  autoUpdater.on('update-available', (info) => {
    console.log(`Update ${info.version} available, downloading in background`);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('App is up to date');
    if (manualCheckPending) {
      manualCheckPending = false;
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No Updates Available',
        message: 'You are running the latest version!',
        detail: `Current version: ${app.getVersion()}`,
        buttons: ['OK'],
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendToRenderer('update-download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    manualCheckPending = false;
    sendToRenderer('update:downloaded', { version: info.version });
    promptRestart(info);
  });

  // Never show error dialogs from here; manual checks report via checkForUpdates().
  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
  });

  setTimeout(backgroundCheck, FIRST_CHECK_DELAY_MS);
  setInterval(backgroundCheck, CHECK_INTERVAL_MS);
}

/**
 * Manually check for updates (menu item / renderer button)
 * @param {BrowserWindow} window - The main application window
 */
function checkForUpdates(window) {
  if (window) mainWindow = window;

  if (!app.isPackaged) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Development Mode',
      message: 'Auto-updater is disabled in development mode.',
      detail: 'Updates only work in production builds.\n\nTo test updates:\n1. Build: npm run build-production\n2. Install the .exe from production-exe folder\n3. Then publish a new version to GitHub',
      buttons: ['OK'],
    });
    return;
  }

  manualCheckPending = true;
  autoUpdater.checkForUpdates().catch((err) => {
    manualCheckPending = false;
    console.error('Update check error:', err);
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Cannot Check for Updates',
      message: 'Unable to check for updates at this time.',
      detail: 'Check your internet connection and try again. Your app will continue to work normally.',
      buttons: ['OK'],
    });
  });
}

module.exports = {
  initializeUpdater,
  checkForUpdates,
};
