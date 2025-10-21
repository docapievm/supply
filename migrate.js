// migrate.js — create DB and tokens table
require('dotenv').config();
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_FILE = process.env.DATABASE_FILE || './data/supply.db';
const dir = path.dirname(DB_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_FILE);
db.exec(`
CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  chain_key TEXT NOT NULL,
  chain_name TEXT,
  supply_input TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_address_chain ON tokens(address, chain_key);
`);
console.log('Migration complete:', DB_FILE);
db.close();
