// server/metadata.js — on-chain metadata fetch + tokenlist logo discovery + caching
const fetch = require('node-fetch');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

const TOKENLIST_CACHE = path.join(__dirname, '..', 'data', 'tokenlists.json');

// simple chain config with prioritized RPCs (inject Alchemy/Infura if env present)
function rpcCandidatesForChain(chainKey) {
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  const infuraId = process.env.INFURA_PROJECT_ID;
  const arr = [];
  if (chainKey === 'eth') {
    if (alchemyKey) arr.push(`https://eth-mainnet.alchemyapi.io/v2/${alchemyKey}`);
    if (infuraId) arr.push(`https://mainnet.infura.io/v3/${infuraId}`);
    arr.push('https://cloudflare-eth.com');
    arr.push('https://rpc.ankr.com/eth');
  } else if (chainKey === 'polygon') {
    if (alchemyKey) arr.push(`https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`);
    if (infuraId) arr.push(`https://polygon-mainnet.infura.io/v3/${infuraId}`);
    arr.push('https://polygon-rpc.com');
    arr.push('https://rpc.ankr.com/polygon');
  } else if (chainKey === 'bsc') {
    arr.push('https://bsc-dataseed.binance.org');
    arr.push('https://rpc.ankr.com/bsc');
  } else {
    // default fallback
    arr.push('https://rpc.ankr.com/eth');
  }
  return arr;
}

async function probeProvider(provider, timeoutMs = 3000) {
  return Promise.race([provider.getBlockNumber(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))]);
}

async function fetchMetadataForToken(address, chainKey, timeoutMs = 7000) {
  const candidates = rpcCandidatesForChain(chainKey);
  const ERC20 = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)'
  ];

  const meta = { name: null, symbol: null, decimals: null, totalSupply: null, logo: null };

  for (const rpc of candidates) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpc);
      await probeProvider(provider, 2500);
      const contract = new ethers.Contract(address, ERC20, provider);

      const results = await Promise.allSettled([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.totalSupply()
      ]);

      if (results[0].status === 'fulfilled') meta.name = results[0].value;
      if (results[1].status === 'fulfilled') meta.symbol = results[1].value;
      if (results[2].status === 'fulfilled') meta.decimals = results[2].value;
      if (results[3].status === 'fulfilled') meta.totalSupply = results[3].value ? results[3].value.toString() : null;

      // if we found something useful, break
      if (meta.name || meta.symbol || meta.totalSupply) {
        return meta;
      }
    } catch (e) {
      // try next RPC
      continue;
    }
  }
  throw new Error('metadata fetch failed across RPC candidates');
}

// Tokenlists: fetch + cache tokenlists (Uniswap tokens list by default)
async function refreshTokenlistsCache() {
  const tokenlistUrls = (process.env.TOKENLIST_URLS || 'https://tokens.uniswap.org').split(',').map(s => s.trim()).filter(Boolean);
  const all = [];
  for (const url of tokenlistUrls) {
    try {
      const r = await fetch(url, { timeout: 5000 });
      if (!r.ok) continue;
      const js = await r.json();
      if (js.tokens && Array.isArray(js.tokens)) {
        js.tokens.forEach(t => {
          all.push({ ...t, source: url });
        });
      }
    } catch (e) {
      // continue
    }
  }
  fs.writeFileSync(TOKENLIST_CACHE, JSON.stringify(all, null, 2), 'utf8');
  return all;
}

function loadTokenlistsCache() {
  if (!fs.existsSync(TOKENLIST_CACHE)) return [];
  try {
    const raw = fs.readFileSync(TOKENLIST_CACHE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function fetchLogoFromTokenlists(chainKey, address) {
  const list = loadTokenlistsCache();
  if (!list || list.length === 0) {
    try { await refreshTokenlistsCache(); } catch (e) {}
  }
  const tokens = loadTokenlistsCache();
  if (!tokens || tokens.length === 0) return null;
  const normalized = address.toLowerCase();
  for (const t of tokens) {
    if (t.address && t.address.toLowerCase() === normalized) {
      if (t.logoURI) return t.logoURI;
      if (t.logo) return t.logo;
    }
  }
  return null;
}

module.exports = { fetchMetadataForToken, fetchLogoFromTokenlists, refreshTokenlistsCache };
