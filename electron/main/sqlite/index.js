/**
 * SQLite Database Module - BaristaFlow Desktop
 * Provides persistent local storage for orders, backup, and reporting
 */
const path = require('node:path');
const fs = require('node:fs');

let Database;
try {
  Database = require('better-sqlite3');
} catch (err) {
  console.warn('⚠️ [SQLite] better-sqlite3 not available:', err.message);
  Database = null;
}

/** @type {import('better-sqlite3').Database | null} */
let db = null;

/** Prepared statements cache */
const statements = {};

/**
 * Get the database file path
 * @param {import('electron').App} app - Electron app instance
 * @returns {string}
 */
function getDbPath(app) {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'database');
  
  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  return path.join(dbDir, 'baristaflow.sqlite');
}

/**
 * Initialize SQLite database
 * @param {import('electron').App} app - Electron app instance
 */
function initDatabase(app) {
  if (!Database) {
    console.error('❌ [SQLite] better-sqlite3 is not available');
    return null;
  }

  if (db) return db;

  const dbPath = getDbPath(app);
  console.log('🗄️ [SQLite] Initializing database at:', dbPath);

  try {
    db = new Database(dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null,
    });

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000'); // 64MB cache
    db.pragma('temp_store = MEMORY');
    db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O

    // Create tables
    createTables();

    // Prepare frequently used statements
    prepareStatements();

    console.log('✅ [SQLite] Database initialized successfully');
    return db;
  } catch (err) {
    console.error('❌ [SQLite] Failed to initialize database:', err);
    return null;
  }
}

/**
 * Create database tables
 */
function createTables() {
  if (!db) return;

  // Orders table - backup of all orders
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      local_id TEXT PRIMARY KEY,
      server_id TEXT,
      order_number INTEGER,
      table_id TEXT,
      table_name TEXT,
      items TEXT,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      service_fee REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'waiting',
      payment_status TEXT DEFAULT 'pending',
      payment_method TEXT,
      order_type TEXT DEFAULT 'dine-in',
      created_by TEXT,
      store_id TEXT,
      notes TEXT,
      sync_status TEXT DEFAULT 'pending',
      sync_retries INTEGER DEFAULT 0,
      sync_error TEXT,
      created_at TEXT,
      updated_at TEXT,
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
  `);

  // Archived orders - completed/cancelled orders moved here
  db.exec(`
    CREATE TABLE IF NOT EXISTS archived_orders (
      local_id TEXT PRIMARY KEY,
      server_id TEXT,
      order_number INTEGER,
      table_id TEXT,
      table_name TEXT,
      items TEXT,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      service_fee REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT,
      payment_status TEXT,
      payment_method TEXT,
      order_type TEXT,
      created_by TEXT,
      store_id TEXT,
      notes TEXT,
      created_at TEXT,
      completed_at TEXT,
      archived_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_archived_created_at ON archived_orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_archived_store_id ON archived_orders(store_id);
  `);

  // Products cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      name TEXT,
      name_ar TEXT,
      price REAL,
      category_id TEXT,
      category_name TEXT,
      image TEXT,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      data TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
  `);

  // Categories cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      name TEXT,
      name_ar TEXT,
      icon TEXT,
      color TEXT,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      data TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);
  `);

  // Tables cache
  db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      name TEXT,
      name_ar TEXT,
      number INTEGER,
      status TEXT DEFAULT 'available',
      zone TEXT,
      capacity INTEGER DEFAULT 4,
      current_order TEXT,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      data TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status);
    CREATE INDEX IF NOT EXISTS idx_tables_active ON tables(is_active);
  `);

  // Sync log
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      entity_type TEXT,
      entity_id TEXT,
      status TEXT,
      error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log(created_at);
  `);

  // Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('✅ [SQLite] Tables created');
}

/**
 * Prepare frequently used statements
 */
function prepareStatements() {
  if (!db) return;

  // Orders
  statements.insertOrder = db.prepare(`
    INSERT OR REPLACE INTO orders (
      local_id, server_id, order_number, table_id, table_name, items,
      subtotal, tax, discount, service_fee, total, status, payment_status,
      payment_method, order_type, created_by, store_id, notes,
      sync_status, sync_retries, sync_error, created_at, updated_at, synced_at
    ) VALUES (
      @local_id, @server_id, @order_number, @table_id, @table_name, @items,
      @subtotal, @tax, @discount, @service_fee, @total, @status, @payment_status,
      @payment_method, @order_type, @created_by, @store_id, @notes,
      @sync_status, @sync_retries, @sync_error, @created_at, @updated_at, @synced_at
    )
  `);

  statements.getOrder = db.prepare('SELECT * FROM orders WHERE local_id = ?');
  statements.getOrderByServerId = db.prepare('SELECT * FROM orders WHERE server_id = ?');
  statements.getPendingOrders = db.prepare(`
    SELECT * FROM orders WHERE sync_status IN ('pending', 'failed') ORDER BY created_at ASC
  `);
  statements.updateOrderSyncStatus = db.prepare(`
    UPDATE orders SET sync_status = ?, server_id = ?, synced_at = ?, sync_error = ? WHERE local_id = ?
  `);
  statements.getRecentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ?');

  // Products
  statements.insertProduct = db.prepare(`
    INSERT OR REPLACE INTO products (
      id, server_id, name, name_ar, price, category_id, category_name,
      image, is_active, display_order, data, updated_at
    ) VALUES (
      @id, @server_id, @name, @name_ar, @price, @category_id, @category_name,
      @image, @is_active, @display_order, @data, @updated_at
    )
  `);
  statements.getAllProducts = db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY display_order');
  statements.getProductsByCategory = db.prepare('SELECT * FROM products WHERE category_id = ? AND is_active = 1 ORDER BY display_order');

  // Categories
  statements.insertCategory = db.prepare(`
    INSERT OR REPLACE INTO categories (
      id, server_id, name, name_ar, icon, color, is_active, display_order, data, updated_at
    ) VALUES (
      @id, @server_id, @name, @name_ar, @icon, @color, @is_active, @display_order, @data, @updated_at
    )
  `);
  statements.getAllCategories = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY display_order');

  // Tables
  statements.insertTable = db.prepare(`
    INSERT OR REPLACE INTO tables (
      id, server_id, name, name_ar, number, status, zone, capacity,
      current_order, is_active, display_order, data, updated_at
    ) VALUES (
      @id, @server_id, @name, @name_ar, @number, @status, @zone, @capacity,
      @current_order, @is_active, @display_order, @data, @updated_at
    )
  `);
  statements.getAllTables = db.prepare('SELECT * FROM tables WHERE is_active = 1 ORDER BY display_order');
  statements.updateTableStatus = db.prepare('UPDATE tables SET status = ?, current_order = ?, updated_at = ? WHERE id = ?');

  // Settings
  statements.getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  statements.setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');

  // Sync log
  statements.insertSyncLog = db.prepare(`
    INSERT INTO sync_log (action, entity_type, entity_id, status, error) VALUES (?, ?, ?, ?, ?)
  `);

  console.log('✅ [SQLite] Statements prepared');
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('🗄️ [SQLite] Database closed');
  }
}

/**
 * Get database instance
 * @returns {import('better-sqlite3').Database | null}
 */
function getDb() {
  return db;
}

/**
 * Get prepared statement
 * @param {string} name - Statement name
 * @returns {import('better-sqlite3').Statement | null}
 */
function getStatement(name) {
  return statements[name] || null;
}

// Export functions
module.exports = {
  initDatabase,
  closeDatabase,
  getDb,
  getStatement,
  getDbPath,
};
