/**
 * Preload Script – BaristaFlow Desktop
 * Exposes a safe, typed API to the renderer via contextBridge.
 * NEVER expose full ipcRenderer or Node modules.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /*───────────────────────────────────────────────────────────────────────────*
   * Settings
   *───────────────────────────────────────────────────────────────────────────*/
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (data) => ipcRenderer.invoke('settings:set', data),

  /*───────────────────────────────────────────────────────────────────────────*
   * Printers
   *───────────────────────────────────────────────────────────────────────────*/
  getPrinters: () => ipcRenderer.invoke('printers:list'),
  printReceipt: (html, copies) => {
    console.log(`🌉 [Preload] printReceipt called:`, {
      htmlLength: html?.length || 0,
      htmlPreview: html ? html.substring(0, 150) : 'NO HTML',
      copies
    });
    return ipcRenderer.invoke('printers:printReceipt', html, copies);
  },
  printOrderReceipt: (jsonData, copies) => ipcRenderer.invoke('printers:printOrderReceipt', jsonData, copies),
  printOrderReceiptMulti: (jsonData, copies, printerIds) => ipcRenderer.invoke('printers:printOrderReceiptMulti', jsonData, copies, printerIds),
  printOrderReceiptToAll: (jsonData, copies) => ipcRenderer.invoke('printers:printOrderReceiptToAll', jsonData, copies),
  printBarcodeLabel: (jsonData) => ipcRenderer.invoke('printers:printBarcodeLabel', jsonData),
  openDrawer: () => ipcRenderer.invoke('printers:openDrawer'),

  /*───────────────────────────────────────────────────────────────────────────*
   * SQLite Database (Backup & Reporting)
   *───────────────────────────────────────────────────────────────────────────*/
  db: {
    // Orders
    saveOrder: (order) => ipcRenderer.invoke('sqlite:order:save', order),
    getOrder: (localId) => ipcRenderer.invoke('sqlite:order:get', localId),
    getPendingOrders: () => ipcRenderer.invoke('sqlite:order:getPending'),
    updateOrderSyncStatus: (localId, status, serverId, error) => 
      ipcRenderer.invoke('sqlite:order:updateSyncStatus', localId, status, serverId, error),
    getRecentOrders: (limit) => ipcRenderer.invoke('sqlite:order:getRecent', limit),
    
    // Products
    syncProducts: (products) => ipcRenderer.invoke('sqlite:products:sync', products),
    getProducts: () => ipcRenderer.invoke('sqlite:products:getAll'),
    
    // Categories
    syncCategories: (categories) => ipcRenderer.invoke('sqlite:categories:sync', categories),
    getCategories: () => ipcRenderer.invoke('sqlite:categories:getAll'),
    
    // Tables
    syncTables: (tables) => ipcRenderer.invoke('sqlite:tables:sync', tables),
    getTables: () => ipcRenderer.invoke('sqlite:tables:getAll'),
    updateTableStatus: (tableId, status, orderId) => 
      ipcRenderer.invoke('sqlite:tables:updateStatus', tableId, status, orderId),
    
    // Settings
    getSetting: (key) => ipcRenderer.invoke('sqlite:settings:get', key),
    setSetting: (key, value) => ipcRenderer.invoke('sqlite:settings:set', key, value),
    
    // Sync log
    logSync: (action, entityType, entityId, status, error) =>
      ipcRenderer.invoke('sqlite:sync:log', action, entityType, entityId, status, error),
  },

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
