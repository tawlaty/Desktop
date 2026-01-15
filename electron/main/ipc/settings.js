/**
 * IPC: Settings
 * Reads/writes user settings to a JSON file in app.getPath('userData').
 * Also provides a simple store interface for other modules (e.g., printers).
 */
const fs = require('node:fs');
const path = require('node:path');

let settingsPath = '';
let cachedSettings = {};

/**
 * Simple settings store (in-memory cache + file persistence)
 */
const settingsStore = {
  getAll: () => cachedSettings,
  get: (key) => cachedSettings[key],
  set: (key, value) => {
    cachedSettings[key] = value;
    saveSettings();
  },
  setAll: (data) => {
    cachedSettings = { ...cachedSettings, ...data };
    saveSettings();
  },
};

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      cachedSettings = JSON.parse(raw);
    }
  } catch (error) {
    console.error('[settings] Error loading settings:', error);
    cachedSettings = {};
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(cachedSettings, null, 2), 'utf-8');
  } catch (error) {
    console.error('[settings] Error saving settings:', error);
  }
}

/**
 * @param {Electron.IpcMain} ipcMain
 * @param {Electron.App} app
 */
function register(ipcMain, app) {
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  loadSettings();

  ipcMain.handle('settings:get', async () => {
    return cachedSettings;
  });

  ipcMain.handle('settings:set', async (_event, data) => {
    try {
      cachedSettings = { ...cachedSettings, ...data };
      saveSettings();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('app:version', () => app.getVersion());
}

module.exports = { register, settingsStore };
