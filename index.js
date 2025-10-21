// index.js — Express API server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pino = require('pino');
const bodyParser = require('body-parser');
const path = require('path');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const { initDb, dbGetAllTokens, dbCreateToken, dbUpdateToken, dbDeleteToken, dbGetTokenById } = require('./server/db');
const { fetchMetadataForToken, fetchLogoFromTokenlists, refreshTokenlistsCache } = require('./server/metadata');

const PORT = process.env.PORT || 4000;

initDb();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// serve static client if present in public/
app.use(express.static(path.join(__dirname, 'public')));

// health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// tokens CRUD
app.get('/api/tokens', async (req, res) => {
  try {
    const rows = dbGetAllTokens();
    res.json(rows);
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/tokens', async (req, res) => {
  try {
    const { address, chainKey, chainName, supplyInput, fetchOnchain, applyMediaXr } = req.body;
    if (!address || !chainKey) return res.status(400).json({ error: 'address and chainKey required' });

    // Create DB entry (metadata empty for now)
    const now = new Date().toISOString();
    const token = {
      address,
      chain_key: chainKey,
      chain_name: chainName || chainKey,
      supply_input: supplyInput || null,
      metadata: null,
      created_at: now
    };

    // Attempt on-chain fetch (server uses providers with API keys and fallbacks)
    if (fetchOnchain) {
      try {
        const meta = await fetchMetadataForToken(address, chainKey);
        token.metadata = meta;
        if ((!supplyInput || supplyInput === '') && meta.totalSupply) {
          token.supply_input = meta.totalSupply;
        }
      } catch (e) {
        logger.warn({ err: e }, 'on-chain metadata fetch failed');
      }
    }

    // Attempt logo discovery via tokenlists if no logo present
    if (!token.metadata || !token.metadata.logo) {
      try {
        const logo = await fetchLogoFromTokenlists(chainKey, address);
        if (logo) {
          token.metadata = Object.assign({}, token.metadata || {}, { logo });
        }
      } catch (e) {
        logger.warn({ err: e }, 'tokenlist logo lookup failed');
      }
    }

    // Apply MEDIAXR preset if requested (overrides)
    if (applyMediaXr) {
      token.metadata = Object.assign({}, token.metadata || {}, {
        name: 'MEDIAXR',
        symbol: 'RXR',
        logo: 'https://musicchain.netlify.app/android-chrome-512x512.png'
      });
    }

    const created = dbCreateToken(token);
    res.status(201).json(created);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.put('/api/tokens/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const payload = req.body;
    const updated = dbUpdateToken(id, payload);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
});

app.delete('/api/tokens/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    dbDeleteToken(id);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
});

// endpoint to trigger metadata refresh for an entry
app.post('/api/tokens/:id/refresh', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const token = dbGetTokenById(id);
    if (!token) return res.status(404).json({ error: 'not found' });

    const meta = await fetchMetadataForToken(token.address, token.chain_key);
    const merged = Object.assign({}, token.metadata || {}, meta);
    dbUpdateToken(id, { metadata: merged });
    res.json({ ok: true, metadata: merged });
  } catch (e) {
    logger.warn(e);
    res.status(500).json({ error: e.message });
  }
});

// manual refresh of tokenlists cache
app.post('/api/tokenlists/refresh', async (req, res) => {
  try {
    await refreshTokenlistsCache();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  logger.info(`Supply server running on port ${PORT}`);
});
