/**
 * Auto-Updater Module - GitHub Releases Integration
 * Handles checking for updates, downloading, and notifying users
 */
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

// Configure updater
autoUpdater.autoDownload = false; // Don't auto-download, ask user first
autoUpdater.autoInstallOnAppQuit = true;

/**
 * Initialize the auto-updater
 * @param {BrowserWindow} mainWindow - The main application window
 */
function initializeUpdater(mainWindow) {
  if (process.env.NODE_ENV === 'development') {
    console.log('Auto-updater disabled in development mode');
    return;
  }

  // Check for updates on app start (after 3 seconds)
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 3000);

  // Event: Update available
  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available!`,
        detail: 'Would you like to download it now?',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
          
          // Show download started notification
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Downloading Update',
            message: 'Update is being downloaded in the background.',
            detail: 'You will be notified when it\'s ready to install.',
            buttons: ['OK'],
          });
        }
      });
  });

  // Event: No update available
  autoUpdater.on('update-not-available', () => {
    console.log('App is up to date');
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
    console.log(message);
    
    // Send to renderer if you want to show progress in UI
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-download-progress', progressObj);
    }
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded.`,
        detail: 'The update will be installed when you restart the application. Restart now?',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
  });

  // Event: Error
  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
    // Optionally show error to user
    // dialog.showErrorBox('Update Error', 'Failed to check for updates. Please try again later.');
  });
}

/**
 * Manually check for updates
 * @param {BrowserWindow} mainWindow - The main application window
 */
function checkForUpdates(mainWindow) {
  autoUpdater.checkForUpdates();
}

module.exports = {
  initializeUpdater,
  checkForUpdates,
};
