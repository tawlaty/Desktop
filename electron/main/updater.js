/**
 * Auto-Updater Module - GitHub Releases Integration (tawlaty/Desktop, public)
 *
 * Updates download silently in the background and install on quit. When a
 * download finishes the user gets one non-blocking "restart now / later"
 * prompt; "Later" simply installs on the next quit. We never force a restart.
 *
 * Background checks stay silent. A manual check (menu item) reports every
 * outcome: up to date, update found (download starts), already downloading,
 * or the failure reason. Updater logs persist to
 * %APPDATA%\Tawlaty\logs\main.log via electron-log.
 */
const { autoUpdater } = require('electron-updater');
const { dialog, app } = require('electron');
const log = require('electron-log');

autoUpdater.logger = log;

const FIRST_CHECK_DELAY_MS = 3 * 1000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow = null;
let initialized = false;
let manualCheckPending = false;
let restartPromptOpen = false;
let downloading = false;
let downloadVersion = null;
let downloadPercent = 0;

function setTaskbarProgress(value) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setProgressBar(value);
  }
}

function endDownload() {
  downloading = false;
  downloadVersion = null;
  downloadPercent = 0;
  setTaskbarProgress(-1);
}

function logFilePath() {
  try {
    return log.transports.file.getFile().path;
  } catch {
    return '%APPDATA%\\Tawlaty\\logs\\main.log';
  }
}

/**
 * Warn about a failed manual check/download. No-op unless a manual check is
 * pending, so the check rejection and the 'error' event don't both open a dialog.
 */
function reportManualFailure(err) {
  if (!manualCheckPending) return;
  manualCheckPending = false;
  const reason = (err && err.message ? err.message : String(err)).split('\n')[0].slice(0, 300);
  dialog.showMessageBox({
    type: 'warning',
    title: 'Cannot Check for Updates',
    message: 'Unable to check for updates at this time.',
    detail: `${reason}\n\nCheck your internet connection and try again. Your app will continue to work normally.\n\nDetails are in the log file:\n${logFilePath()}`,
    buttons: ['OK'],
  });
}

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
    log.error('Update check failed:', err.message);
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
    .catch((err) => log.error('Update prompt failed:', err))
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
    log.info('Auto-updater disabled in development mode');
    return;
  }
  if (initialized) return;
  initialized = true;

  autoUpdater.on('update-available', (info) => {
    log.info(`Update ${info.version} available, downloading in background`);
    downloading = true;
    downloadVersion = info.version;
    downloadPercent = 0;
    if (manualCheckPending) {
      // Stays pending until the download finishes or fails.
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `Update ${info.version} found.`,
        detail: "Downloading in the background. You'll be asked to restart when it's ready.",
        buttons: ['OK'],
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    log.info('App is up to date');
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
    downloadPercent = Math.round(progressObj.percent || 0);
    setTaskbarProgress((progressObj.percent || 0) / 100);
    sendToRenderer('update-download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    manualCheckPending = false;
    endDownload();
    sendToRenderer('update:downloaded', { version: info.version });
    promptRestart(info);
  });

  // Background failures are logged only; a pending manual check also gets a dialog.
  autoUpdater.on('error', (error) => {
    log.error('Auto-updater error:', error);
    endDownload();
    reportManualFailure(error);
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

  if (downloading) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Downloading',
      message: `Update ${downloadVersion} is already downloading (${downloadPercent}%).`,
      detail: "You'll be asked to restart when it's ready.",
      buttons: ['OK'],
    });
    return;
  }

  manualCheckPending = true;
  autoUpdater.checkForUpdates().catch((err) => {
    log.error('Update check error:', err);
    reportManualFailure(err);
  });
}

module.exports = {
  initializeUpdater,
  checkForUpdates,
};
