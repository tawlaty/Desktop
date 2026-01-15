/**
 * SQLite IPC Handlers - BaristaFlow Desktop
 * Exposes SQLite operations to renderer via IPC
 */
const sqlite = require('../sqlite');

/**
 * Register SQLite IPC handlers
 * @param {import('electron').IpcMain} ipcMain
 * @param {import('electron').App} app
 */
function register(ipcMain, app) {
  // Initialize database on registration
  sqlite.initDatabase(app);

  const db = sqlite.getDb();
  if (!db) {
    console.warn('⚠️ [SQLite IPC] Database not available');
    return;
  }

  /*───────────────────────────────────────────────────────────────────────────*
   * Orders
   *───────────────────────────────────────────────────────────────────────────*/

  ipcMain.handle('sqlite:order:save', async (_event, order) => {
    try {
      const stmt = sqlite.getStatement('insertOrder');
      if (!stmt) return { success: false, error: 'Statement not prepared' };

      stmt.run({
        local_id: order.localId,
        server_id: order.serverId || null,
        order_number: order.orderNumber || null,
        table_id: order.tableId || null,
        table_name: order.tableName || null,
        items: JSON.stringify(order.items || []),
        subtotal: order.subtotal || 0,
        tax: order.tax || 0,
        discount: order.discount || 0,
        service_fee: order.serviceFee || 0,
        total: order.total || 0,
        status: order.status || 'waiting',
        payment_status: order.paymentStatus || 'pending',
        payment_method: order.paymentMethod || null,
        order_type: order.orderType || 'dine-in',
        created_by: order.createdBy || null,
        store_id: order.store || null,
        notes: order.notes || null,
        sync_status: order.syncStatus || 'pending',
        sync_retries: order.syncRetries || 0,
        sync_error: order.syncError || null,
        created_at: order.createdAt || new Date().toISOString(),
        updated_at: order.updatedAt || new Date().toISOString(),
        synced_at: order.lastSyncedAt || null,
      });

      return { success: true };
    } catch (err) {
      console.error('❌ [SQLite] Failed to save order:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sqlite:order:get', async (_event, localId) => {
    try {
      const stmt = sqlite.getStatement('getOrder');
      if (!stmt) return null;

      const row = stmt.get(localId);
      return row ? parseOrderRow(row) : null;
    } catch (err) {
      console.error('❌ [SQLite] Failed to get order:', err);
      return null;
    }
  });

  ipcMain.handle('sqlite:order:getPending', async () => {
    try {
      const stmt = sqlite.getStatement('getPendingOrders');
      if (!stmt) return [];

      const rows = stmt.all();
      return rows.map(parseOrderRow);
    } catch (err) {
      console.error('❌ [SQLite] Failed to get pending orders:', err);
      return [];
    }
  });

  ipcMain.handle('sqlite:order:updateSyncStatus', async (_event, localId, status, serverId, error) => {
    try {
      const stmt = sqlite.getStatement('updateOrderSyncStatus');
      if (!stmt) return { success: false, error: 'Statement not prepared' };

      stmt.run(status, serverId || null, new Date().toISOString(), error || null, localId);
      return { success: true };
    } catch (err) {
      console.error('❌ [SQLite] Failed to update order sync status:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sqlite:order:getRecent', async (_event, limit = 50) => {
    try {
      const stmt = sqlite.getStatement('getRecentOrders');
      if (!stmt) return [];

      const rows = stmt.all(limit);
      return rows.map(parseOrderRow);
    } catch (err) {
      console.error('❌ [SQLite] Failed to get recent orders:', err);
      return [];
    }
  });

  /*───────────────────────────────────────────────────────────────────────────*
   * Products
   *───────────────────────────────────────────────────────────────────────────*/

  ipcMain.handle('sqlite:products:sync', async (_event, products) => {
    try {
      const stmt = sqlite.getStatement('insertProduct');
      if (!stmt) return { success: false, error: 'Statement not prepared' };

      const now = new Date().toISOString();
      const insertMany = db.transaction((items) => {
        for (const product of items) {
          stmt.run({
            id: product._id || product.id,
            server_id: product._id,
            name: product.name || '',
            name_ar: product.nameAr || '',
            price: product.price || 0,
            category_id: product.category?._id || product.category || '',
            category_name: product.category?.name || '',
            image: product.image || '',
            is_active: product.isActive !== false ? 1 : 0,
            display_order: product.displayOrder || 0,
            data: JSON.stringify(product),
            updated_at: now,
          });
        }
      });

      insertMany(products);
      return { success: true, count: products.length };
    } catch (err) {
      console.error('❌ [SQLite] Failed to sync products:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sqlite:products:getAll', async () => {
    try {
      const stmt = sqlite.getStatement('getAllProducts');
      if (!stmt) return [];

      const rows = stmt.all();
      return rows.map((row) => JSON.parse(row.data || '{}'));
    } catch (err) {
      console.error('❌ [SQLite] Failed to get products:', err);
      return [];
    }
  });

  /*───────────────────────────────────────────────────────────────────────────*
   * Categories
   *───────────────────────────────────────────────────────────────────────────*/

  ipcMain.handle('sqlite:categories:sync', async (_event, categories) => {
    try {
      const stmt = sqlite.getStatement('insertCategory');
      if (!stmt) return { success: false, error: 'Statement not prepared' };

      const now = new Date().toISOString();
      const insertMany = db.transaction((items) => {
        for (const category of items) {
          stmt.run({
            id: category._id || category.id,
            server_id: category._id,
            name: category.name || '',
            name_ar: category.nameAr || '',
            icon: category.icon || '',
            color: category.color || '',
            is_active: category.isActive !== false ? 1 : 0,
            display_order: category.displayOrder || 0,
            data: JSON.stringify(category),
            updated_at: now,
          });
        }
      });

      insertMany(categories);
      return { success: true, count: categories.length };
    } catch (err) {
      console.error('❌ [SQLite] Failed to sync categories:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sqlite:categories:getAll', async () => {
    try {
      const stmt = sqlite.getStatement('getAllCategories');
      if (!stmt) return [];

      const rows = stmt.all();
      return rows.map((row) => JSON.parse(row.data || '{}'));
    } catch (err) {
      console.error('❌ [SQLite] Failed to get categories:', err);
      return [];
    }
  });

  /*───────────────────────────────────────────────────────────────────────────*
   * Tables
   *───────────────────────────────────────────────────────────────────────────*/

  ipcMain.handle('sqlite:tables:sync', async (_event, tables) => {
    try {
      const stmt = sqlite.getStatement('insertTable');
      if (!stmt) return { success: false, error: 'Statement not prepared' };

      const now = new Date().toISOString();
      const insertMany = db.transaction((items) => {
        for (const table of items) {
          stmt.run({
            id: table._id || table.id,
            server_id: table._id,
            name: table.name || '',
            name_ar: table.nameAr || '',
            number: table.number || 0,
            status: table.status || 'available',
            zone: table.zone || '',
            capacity: table.capacity || 4,
            current_order: table.currentOrder?._id || table.currentOrder || '',
            is_active: table.isActive !== false ? 1 : 0,
            display_order: table.displayOrder || 0,
            data: JSON.stringify(table),
            updated_at: now,
          });
        }
      });

      insertMany(tables);
      return { success: true, count: tables.length };
    } catch (err) {
      console.error('❌ [SQLite] Failed to sync tables:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('sqlite:tables:getAll', async () => {
    try {
      const stmt = sqlite.getStatement('getAllTables');
      if (!stmt) return [];

      const rows = stmt.all();
      return rows.map((row) => JSON.parse(row.data || '{}'));
    } catch (err) {
      console.error('❌ [SQLite] Failed to get tables:', err);
      return [];
    }
  });

  ipcMain.handle('sqlite:tables:updateStatus', async (_event, tableId, status, orderId) => {
    try {
      const stmt = sqlite.getStatement('updateTableStatus');
      if (!stmt) return { success: false, error: 'Statement not prepared' };

      stmt.run(status, orderId || null, new Date().toISOString(), tableId);
      return { success: true };
    } catch (err) {
      console.error('❌ [SQLite] Failed to update table status:', err);
      return { success: false, error: err.message };
    }
  });

  /*───────────────────────────────────────────────────────────────────────────*
   * Settings
   *───────────────────────────────────────────────────────────────────────────*/

  ipcMain.handle('sqlite:settings:get', async (_event, key) => {
    try {
      const stmt = sqlite.getStatement('getSetting');
      if (!stmt) return null;

      const row = stmt.get(key);
      if (!row) return null;

      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    } catch (err) {
      console.error('❌ [SQLite] Failed to get setting:', err);
      return null;
    }
  });

  ipcMain.handle('sqlite:settings:set', async (_event, key, value) => {
    try {
      const stmt = sqlite.getStatement('setSetting');
      if (!stmt) return { success: false, error: 'Statement not prepared' };

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      stmt.run(key, stringValue, new Date().toISOString());
      return { success: true };
    } catch (err) {
      console.error('❌ [SQLite] Failed to set setting:', err);
      return { success: false, error: err.message };
    }
  });

  /*───────────────────────────────────────────────────────────────────────────*
   * Sync Log
   *───────────────────────────────────────────────────────────────────────────*/

  ipcMain.handle('sqlite:sync:log', async (_event, action, entityType, entityId, status, error) => {
    try {
      const stmt = sqlite.getStatement('insertSyncLog');
      if (!stmt) return { success: false };

      stmt.run(action, entityType, entityId, status, error || null);
      return { success: true };
    } catch (err) {
      console.error('❌ [SQLite] Failed to log sync:', err);
      return { success: false };
    }
  });

  console.log('✅ [SQLite IPC] Handlers registered');
}

/**
 * Parse order row from database
 * @param {Object} row - Database row
 * @returns {Object}
 */
function parseOrderRow(row) {
  return {
    localId: row.local_id,
    serverId: row.server_id,
    orderNumber: row.order_number,
    tableId: row.table_id,
    tableName: row.table_name,
    items: JSON.parse(row.items || '[]'),
    subtotal: row.subtotal,
    tax: row.tax,
    discount: row.discount,
    serviceFee: row.service_fee,
    total: row.total,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    orderType: row.order_type,
    createdBy: row.created_by,
    store: row.store_id,
    notes: row.notes,
    syncStatus: row.sync_status,
    syncRetries: row.sync_retries,
    syncError: row.sync_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSyncedAt: row.synced_at,
  };
}

module.exports = { register };
