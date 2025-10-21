// server/db.js — small wrapper around better-sqlite3
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_FILE = process.env.DATABASE_FILE || path.join(__dirname, '..', 'data', 'supply.db');
const dir = path.dirname(DB_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db;

function initDb() {
  db = new Database(DB_FILE);
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
}

function dbGetAllTokens() {
  const rows = db.prepare('SELECT id, address, chain_key AS chainKey, chain_name AS chainName, supply_input AS supplyInput, metadata, created_at AS createdAt FROM tokens ORDER BY created_at DESC').all();
  return rows.map(r => {
    if (r.metadata) {
      try { r.metadata = JSON.parse(r.metadata); } catch (e) { r.metadata = null; }
    }
    return r;
  });
}

function dbGetTokenById(id) {
  const r = db.prepare('SELECT * FROM tokens WHERE id = ?').get(id);
  if (!r) return null;
  if (r.metadata) {
    try { r.metadata = JSON.parse(r.metadata); } catch (e) { r.metadata = null; }
  }
  return r;
}

function dbCreateToken(obj) {
  const stmt = db.prepare('INSERT INTO tokens (address, chain_key, chain_name, supply_input, metadata, created_at) VALUES (@address, @chain_key, @chain_name, @supply_input, @metadata, @created_at)');
  const info = stmt.run({
    address: obj.address,
    chain_key: obj.chain_key,
    chain_name: obj.chain_name,
    supply_input: obj.supply_input,
    metadata: obj.metadata ? JSON.stringify(obj.metadata) : null,
    created_at: obj.created_at
  });
  return dbGetTokenById(info.lastInsertRowid);
}

function dbUpdateToken(id, payload) {
  const existing = dbGetTokenById(id);
  if (!existing) return null;
  const metadata = payload.metadata !== undefined ? JSON.stringify(payload.metadata) : existing.metadata ? JSON.stringify(existing.metadata) : null;
  const stmt = db.prepare('UPDATE tokens SET address = COALESCE(@address, address), chain_key = COALESCE(@chain_key, chain_key), chain_name = COALESCE(@chain_name, chain_name), supply_input = COALESCE(@supply_input, supply_input), metadata = @metadata WHERE id = @id');
  stmt.run({
    id,
    address: payload.address,
    chain_key: payload.chain_key,
    chain_name: payload.chain_name,
    supply_input: payload.supply_input,
    metadata
  });
  return dbGetTokenById(id);
}

function dbDeleteToken(id) {
  db.prepare('DELETE FROM tokens WHERE id = ?').run(id);
}

module.exports = { initDb, dbGetAllTokens, dbGetTokenById, dbCreateToken, dbUpdateToken, dbDeleteToken };
