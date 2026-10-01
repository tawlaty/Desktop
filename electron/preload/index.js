/**
 * Preload Script – BaristaFlow Desktop
 * Exposes a safe, typed API to the renderer via contextBridge.
 * NEVER expose full ipcRenderer or Node modules.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /*───────────────────────────────────────────────────────────────────────────*
   * Updates
   *───────────────────────────────────────────────────────────────────────────*/
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateNotification: (callback) => {
    ipcRenderer.on('update-available-notification', (event, available) => callback(available));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (event, progress) => callback(progress));
  },

  /*───────────────────────────────────────────────────────────────────────────*
   * Settings
   *───────────────────────────────────────────────────────────────────────────*/
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (data) => ipcRenderer.invoke('settings:set', data),

  /*───────────────────────────────────────────────────────────────────────────*
   * Printers
   *───────────────────────────────────────────────────────────────────────────*/
  getPrinters: () => ipcRenderer.invoke('printers:list'),
  printReceipt: (html, copies) => ipcRenderer.invoke('printers:printReceipt', html, copies),
  printOrderReceipt: (jsonData, copies) => ipcRenderer.invoke('printers:printOrderReceipt', jsonData, copies),
  printOrderReceiptMulti: (jsonData, copies, printerIds) => ipcRenderer.invoke('printers:printOrderReceiptMulti', jsonData, copies, printerIds),
  printOrderReceiptToAll: (jsonData, copies) => ipcRenderer.invoke('printers:printOrderReceiptToAll', jsonData, copies),
  printBarcodeLabel: (jsonData) => ipcRenderer.invoke('printers:printBarcodeLabel', jsonData),
  openDrawer: () => ipcRenderer.invoke('printers:openDrawer'),

  /*───────────────────────────────────────────────────────────────────────────*
   * Serial / Scale / Scanner (placeholder – enable when IPC module ready)
   *───────────────────────────────────────────────────────────────────────────*/
  // listSerialPorts: () => ipcRenderer.invoke('serial:list'),
  // startScale: (portPath) => ipcRenderer.invoke('serial:startScale', portPath),
  // startScanner: (portPath) => ipcRenderer.invoke('serial:startScanner', portPath),

  /*───────────────────────────────────────────────────────────────────────────*
   * App Info
   *───────────────────────────────────────────────────────────────────────────*/
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  
  /*───────────────────────────────────────────────────────────────────────────*
   * Platform Detection
   *───────────────────────────────────────────────────────────────────────────*/
  isElectron: true,
  platform: process.platform,

  /*───────────────────────────────────────────────────────────────────────────*
   * Generic event subscription (main → renderer) for updates, sync status, etc.
   *───────────────────────────────────────────────────────────────────────────*/
  onMainEvent: (channel, callback) => {
    const allowedChannels = [
      'sync:status',
      'sync:progress',
      'sync:complete',
      'sync:error',
      'orders:pending',
      'orders:synced',
      'app:online',
      'app:offline',
      'db:ready',
    ];
    if (allowedChannels.includes(channel)) {
      const subscription = (_event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      // Return unsubscribe function
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    console.warn(`[preload] Channel "${channel}" is not allowed.`);
    return () => {};
  },
});
