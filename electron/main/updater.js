/**
 * Auto-Updater Module - GitHub Releases Integration
 * Handles checking for updates, downloading, and notifying users
 */
const { autoUpdater } = require('electron-updater');
const { dialog, Notification } = require('electron');

// Configure updater
autoUpdater.autoDownload = false; // Don't auto-download, ask user first
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow = null;
let updateAvailable = false;

/**
 * Show red notification badge when update is available
 */
function showUpdateNotification() {
  updateAvailable = true;
  
  // Send to renderer to show red badge
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available-notification', true);
  }

  // Show system notification
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: 'Baristaflow Update Available',
      body: 'A new version is ready to download. Click to update.',
      urgency: 'critical',
    });
    
    notification.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        promptForUpdate();
      }
    });
    
    notification.show();
  }
}

/**
 * Prompt user to download update
 */
function promptForUpdate() {
  if (!updateAvailable) return;
  
  autoUpdater.checkForUpdates();
}

/**
 * Initialize the auto-updater
 * @param {BrowserWindow} window - The main application window
 */
function initializeUpdater(window) {
  mainWindow = window;
  
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
    updateAvailable = true;
    
    // Show red notification
    showUpdateNotification();
    
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: '🔴 Update Available',
        message: `A new version (${info.version}) is available!`,
        detail: 'Would you like to download it now?',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
          
          // Hide notification badge during download
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-available-notification', false);
          }
          
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
    updateAvailable = false;
    
    // Hide red badge
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available-notification', false);
    }
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
    updateAvailable = false;
    
    // Hide red badge
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available-notification', false);
    }
    
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
 * @param {BrowserWindow} window - The main application window
 */
function checkForUpdates(window) {
  if (window) mainWindow = window;
  
  if (process.env.NODE_ENV === 'development') {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Development Mode',
      message: 'Auto-updater is disabled in development mode.',
      buttons: ['OK'],
    });
    return;
  }
  
  // Show checking dialog
  const checking = dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Checking for Updates',
    message: 'Checking for updates...',
    buttons: ['Cancel'],
  });
  
  autoUpdater.checkForUpdates()
    .then(() => {
      // If no update, show message
      setTimeout(() => {
        if (!updateAvailable) {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'No Updates',
            message: 'You are running the latest version!',
            buttons: ['OK'],
          });
        }
      }, 2000);
    })
    .catch((err) => {
      dialog.showErrorBox('Update Check Failed', 'Could not check for updates. Please try again later.');
    });
}

module.exports = {
  initializeUpdater,
  checkForUpdates,
};
