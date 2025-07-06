const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'membership_saas.db');
const db = new sqlite3.Database(dbPath);

const init = () => {
  // Create users table (both super admin and clients)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super_admin', 'client')),
      gym_name TEXT,
      owner_name TEXT,
      phone TEXT,
      address TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'blocked', 'active')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create plans table
  db.run(`
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      duration_months INTEGER NOT NULL,
      features TEXT,
      is_trial BOOLEAN DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create client_subscriptions table
  db.run(`
    CREATE TABLE IF NOT EXISTS client_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'trial')),
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'confirmed', 'failed')),
      amount_paid DECIMAL(10,2),
      payment_method TEXT,
      payment_reference TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    )
  `);

  // Create members table (gym members)
  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      member_id TEXT UNIQUE,
      membership_plan TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'expired', 'suspended')),
      amount_paid DECIMAL(10,2) NOT NULL,
      payment_method TEXT,
      upi_id TEXT,
      notes TEXT,
      qr_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id)
    )
  `);

  // Create member_payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS member_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_method TEXT NOT NULL,
      upi_id TEXT,
      payment_date DATE NOT NULL,
      for_month TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )
  `);

  // Create attendance table (bonus feature)
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      check_out_time DATETIME,
      date DATE NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )
  `);

  // Insert default super admin
  db.run(`
    INSERT OR IGNORE INTO users (email, password, role, status) 
    VALUES ('admin@saas.com', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', 'super_admin', 'active')
  `);

  // Insert default plans
  db.run(`
    INSERT OR IGNORE INTO plans (name, price, duration_months, features, is_trial) 
    VALUES 
    ('Trial Plan', 0, 1, 'Up to 50 members, Basic features', 1),
    ('Monthly Plan', 999, 1, 'Unlimited members, All features, Priority support', 0),
    ('Yearly Plan', 9999, 12, 'Unlimited members, All features, Priority support, 2 months free', 0)
  `);

  console.log('✅ Database initialized successfully!');
};

const getDb = () => db;

// Helper function to run queries with promises
const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

// Helper function to get all rows
const getAllRows = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Helper function to get single row
const getRow = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

module.exports = {
  init,
  getDb,
  runQuery,
  getAllRows,
  getRow
};