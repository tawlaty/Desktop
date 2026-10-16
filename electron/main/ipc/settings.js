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

/**
 * One-time migration for the Baristaflow -> Tawlaty rename. Changing productName
 * moves app.getPath('userData') from %APPDATA%\Baristaflow to %APPDATA%\Tawlaty,
 * which would otherwise drop printer assignments, kiosk flags and other
 * per-device settings. Copies (never moves) the legacy file; idempotent.
 * @returns {boolean} true when a file was copied
 */
function migrateLegacySettings(newPath, legacyPath, log = console) {
  try {
    if (path.resolve(newPath) === path.resolve(legacyPath)) return false;
    if (fs.existsSync(newPath) || !fs.existsSync(legacyPath)) return false;
    fs.mkdirSync(path.dirname(newPath), { recursive: true });
    fs.copyFileSync(legacyPath, newPath, fs.constants.COPYFILE_EXCL);
    log.log(`[settings] Migrated legacy settings from ${legacyPath} to ${newPath}`);
    return true;
  } catch (error) {
    log.error('[settings] Legacy settings migration failed:', error);
    return false;
  }
}

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
  migrateLegacySettings(settingsPath, path.join(app.getPath('appData'), 'Baristaflow', 'settings.json'));
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

module.exports = { register, settingsStore, migrateLegacySettings };
