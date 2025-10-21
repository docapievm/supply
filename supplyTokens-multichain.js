// supplyTokens-multichain.js
// Multi-chain token creation UI + supply + metadata fetching (ERC-20 style)
// - Adds metadata fetching (name/symbol/decimals/totalSupply) and logo support
// - Integrates multiple RPC endpoints per chain (preferred public endpoints + Ankr fallback)
// - Adds a MEDIAXR preset (Name=MEDIAXR, Symbol=RXR, Logo=provided URL)
// - Persists tokens in localStorage

(function () {
  const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)"
  ];

  const STORAGE_KEYS = {
    TOKENS: 'supply_tokens_v3',
    THEME: 'supply_theme_v3',
    COLUMNS: 'supply_columns_v3'
  };

  // MEDIAXR preset
  const MEDIAXR_PRESET = {
    name: 'MEDIAXR',
    symbol: 'RXR',
    // user-specified logo
    logo: 'https://musicchain.netlify.app/android-chrome-512x512.png'
  };

  // Chains with prioritized list of RPC endpoints (prefer public endpoints first, then Ankr fallback)
  // NOTE: keep endpoints that are public/commonly available. If you have API keys for providers (Alchemy/Infura/QuickNode),
  // you can replace/add those endpoints here for better reliability.
  const CHAINS = [
    { key: 'eth', name: 'Ethereum Mainnet', rpcs: ['https://cloudflare-eth.com', 'https://rpc.ankr.com/eth'] },
    { key: 'goerli', name: 'Ethereum Goerli', rpcs: ['https://rpc.ankr.com/eth_goerli'] },
    { key: 'sepolia', name: 'Ethereum Sepolia', rpcs: ['https://rpc.ankr.com/eth_sepolia'] },
    { key: 'polygon', name: 'Polygon Mainnet', rpcs: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'] },
    { key: 'mumbai', name: 'Polygon Mumbai', rpcs: ['https://rpc.ankr.com/polygon_mumbai'] },
    { key: 'bsc', name: 'BSC Mainnet', rpcs: ['https://bsc-dataseed.binance.org', 'https://rpc.ankr.com/bsc'] },
    { key: 'bsc-testnet', name: 'BSC Testnet', rpcs: ['https://rpc.ankr.com/bsc_testnet'] },
    { key: 'avalanche', name: 'Avalanche C-Chain', rpcs: ['https://api.avax.network/ext/bc/C/rpc', 'https://rpc.ankr.com/avalanche'] },
    { key: 'fuji', name: 'Avalanche Fuji', rpcs: ['https://rpc.ankr.com/avalanche_fuji'] },
    { key: 'fantom', name: 'Fantom Opera', rpcs: ['https://rpc.ankr.com/fantom'] },
    { key: 'arbitrum', name: 'Arbitrum One', rpcs: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'] },
    { key: 'arbitrum-goerli', name: 'Arbitrum Goerli', rpcs: ['https://rpc.ankr.com/arbitrum_goerli'] },
    { key: 'optimism', name: 'Optimism', rpcs: ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism'] },
    { key: 'optimism-goerli', name: 'Optimism Goerli', rpcs: ['https://rpc.ankr.com/optimism_goerli'] },
    { key: 'moonbeam', name: 'Moonbeam', rpcs: ['https://rpc.ankr.com/moonbeam'] },
    { key: 'moonriver', name: 'Moonriver', rpcs: ['https://rpc.ankr.com/moonriver'] },
    { key: 'aurora', name: 'Aurora', rpcs: ['https://mainnet.aurora.dev', 'https://rpc.ankr.com/aurora'] },
    { key: 'celo', name: 'Celo', rpcs: ['https://forno.celo.org', 'https://rpc.ankr.com/celo'] },
    { key: 'klaytn', name: 'Klaytn', rpcs: ['https://public-node-api.klaytn.net/v1/cypress'] },
    { key: 'harmony', name: 'Harmony (One)', rpcs: ['https://rpc.ankr.com/harmony'] },
    { key: 'cronos', name: 'Cronos', rpcs: ['https://evm-cronos.crypto.org', 'https://rpc.ankr.com/cronos'] },
    { key: 'metis', name: 'Metis Andromeda', rpcs: ['https://andromeda.metis.io/?owner=1088', 'https://rpc.ankr.com/metis'] },
    { key: 'okc', name: 'OKC (OKExChain)', rpcs: ['https://exchainrpc.okex.org'] },
    { key: 'zksync', name: 'zkSync Era', rpcs: ['https://mainnet.era.zksync.io'] },
    { key: 'base', name: 'Base', rpcs: ['https://mainnet.base.org'] },
    { key: 'evmos', name: 'Evmos', rpcs: ['https://evm.evmos.org:8545', 'https://rpc.ankr.com/evmos'] },
    { key: 'palm', name: 'Palm', rpcs: ['https://palm-mainnet.infura.io'] },
    { key: 'boba', name: 'Boba Network', rpcs: ['https://mainnet.boba.network'] },
    { key: 'telos', name: 'Telos EVM', rpcs: ['https://mainnet.telos.net/evm'] },
    { key: 'evrynet', name: 'Evrynet (placeholder)', rpcs: ['https://rpc.ankr.com/eth'] } // placeholder
  ];

  // DOM elements
  const tokenInput = document.getElementById('token-input');
  const createBtn = document.getElementById('create-btn');
  const grid = document.getElementById('tokens-grid');
  const chainSelect = document.getElementById('chain-select');
  const supplyInput = document.getElementById('supply-input');
  const fetchOnchainCheckbox = document.getElementById('fetch-onchain');
  const applyMediaXrCheckbox = document.getElementById('apply-mediaxr');

  const themeSelect = document.getElementById('theme-select');
  const columnsSelect = document.getElementById('columns-select');

  // Helpers: storage
  function loadTokens() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TOKENS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to parse tokens', e);
      return [];
    }
  }
  function saveTokens(tokens) {
    localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokens));
  }

  // Utility
  function normalizeAddress(addr) {
    return (addr || '').trim();
  }
  function isValidAddress(addr) {
    if (!addr) return false;
    const a = addr.trim();
    return /^0x[a-fA-F0-9]{40}$/.test(a);
  }

  // Populate chain select
  function initChains() {
    CHAINS.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.key;
      opt.textContent = c.name;
      chainSelect.appendChild(opt);
    });
  }

  // Try to call a simple provider request to verify endpoint works
  async function probeProvider(provider, timeoutMs = 4500) {
    const p = provider.getBlockNumber();
    return Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs))
    ]);
  }

  // Attempt contract calls using each RPC in order until success
  async function fetchOnChainMetadata(address, chainKey, timeoutMs = 7000) {
    const chain = CHAINS.find(c => c.key === chainKey);
    if (!chain) throw new Error('No chain config');

    const meta = { name: null, symbol: null, decimals: null, totalSupply: null, logo: null };
    // try each rpc sequentially for better chance of success
    for (const rpc of (chain.rpcs || [])) {
      let provider;
      try {
        provider = new ethers.providers.JsonRpcProvider(rpc);
      } catch (e) {
        console.warn('Invalid RPC URL', rpc, e);
        continue;
      }
      // quick probe
      try {
        await probeProvider(provider, 3500);
      } catch (e) {
        console.warn('RPC probe failed for', rpc, e);
        // try next RPC
        continue;
      }

      const contract = new ethers.Contract(address, ERC20_ABI, provider);
      // helper with timeout
      const withTimeout = (p, ms) => {
        return Promise.race([
          p,
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
        ]);
      };

      try {
        const [name, symbol, decimals, rawSupply] = await Promise.allSettled([
          withTimeout(contract.name(), timeoutMs),
          withTimeout(contract.symbol(), timeoutMs),
          withTimeout(contract.decimals(), timeoutMs),
          withTimeout(contract.totalSupply(), timeoutMs)
        ]);

        if (name.status === 'fulfilled' && name.value) meta.name = name.value;
        if (symbol.status === 'fulfilled' && symbol.value) meta.symbol = symbol.value;
        if (decimals.status === 'fulfilled' && (decimals.value !== undefined)) meta.decimals = decimals.value;
        if (rawSupply.status === 'fulfilled' && rawSupply.value) meta.totalSupply = rawSupply.value.toString();

        // If at least name or symbol or totalSupply fetched, consider it success and return meta
        if (meta.name || meta.symbol || meta.totalSupply) {
          return meta;
        }
        // otherwise try next RPC
      } catch (e) {
        console.warn('Contract calls failed on rpc', rpc, e);
        // try next RPC
        continue;
      }
    }

    // All RPCs attempted and no useful metadata found
    throw new Error('All RPC endpoints failed or contract does not implement expected ERC20 methods');
  }

  // Render tokens grid
  function render() {
    const tokens = loadTokens();
    grid.innerHTML = '';
    if (tokens.length === 0) {
      grid.innerHTML = '<div class="small">No tokens yet — create token entries using the form above.</div>';
      return;
    }

    tokens.forEach((t, idx) => {
      const card = document.createElement('div');
      card.className = 'token-card';

      const top = document.createElement('div');
      top.className = 'token-row';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.gap = '10px';
      left.style.alignItems = 'center';

      if (t.metadata && t.metadata.logo) {
        const img = document.createElement('img');
        img.className = 'token-logo';
        img.src = t.metadata.logo;
        img.alt = t.metadata.symbol ? `${t.metadata.symbol} logo` : 'logo';
        left.appendChild(img);
      }

      const metaWrap = document.createElement('div');
      metaWrap.className = 'meta-text';
      const title = document.createElement('div');
      title.className = 'meta-title';
      title.textContent = (t.metadata && t.metadata.name) ? t.metadata.name : (t.metadata && t.metadata.symbol) ? t.metadata.symbol : '(unknown)';
      const sub = document.createElement('div');
      sub.className = 'meta-sub';
      sub.textContent = `${t.chainName || t.chainKey} • ${t.metadata && t.metadata.symbol ? t.metadata.symbol : '(?)'}`;
      metaWrap.appendChild(title);
      metaWrap.appendChild(sub);

      left.appendChild(metaWrap);

      const addr = document.createElement('div');
      addr.className = 'token-address';
      addr.textContent = t.address;

      top.appendChild(left);
      top.appendChild(addr);

      const info = document.createElement('div');
      info.className = 'small';
      info.innerHTML = `
        Supply (entered): ${t.supplyInput !== undefined && t.supplyInput !== null && t.supplyInput !== '' ? t.supplyInput : '<i>not set</i>'}
      `;

      // If on-chain totalSupply was fetched, show it
      if (t.metadata && t.metadata.totalSupply) {
        const decimals = (t.metadata.decimals !== undefined && t.metadata.decimals !== null) ? t.metadata.decimals : 'n/a';
        const tsDisplay = t.metadata.totalSupply;
        const onchain = document.createElement('div');
        onchain.className = 'small';
        onchain.innerHTML = `<strong>On-chain totalSupply:</strong> ${tsDisplay} (decimals: ${decimals})`;
        info.appendChild(document.createElement('br'));
        info.appendChild(onchain);
      }

      const actions = document.createElement('div');
      actions.className = 'token-actions';

      const copyBtn = document.createElement('button');
      copyBtn.className = 'icon-btn';
      copyBtn.innerText = 'Copy';
      copyBtn.title = 'Copy address';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(t.address);
          copyBtn.innerText = 'Copied';
          setTimeout(() => copyBtn.innerText = 'Copy', 900);
        } catch (e) {
          console.error(e);
        }
      });

      const fetchBtn = document.createElement('button');
      fetchBtn.className = 'icon-btn';
      fetchBtn.innerText = 'Fetch metadata';
      fetchBtn.title = 'Fetch metadata from chain';
      fetchBtn.addEventListener('click', async () => {
        fetchBtn.disabled = true;
        fetchBtn.innerText = 'Fetching...';
        try {
          const meta = await fetchOnChainMetadata(t.address, t.chainKey);
          t.metadata = Object.assign({}, t.metadata || {}, meta);
          saveAndRefresh(tokens);
        } catch (e) {
          console.warn('Fetch failed', e);
          alert('Metadata fetch failed: ' + (e.message || e));
        } finally {
          fetchBtn.disabled = false;
          fetchBtn.innerText = 'Fetch metadata';
        }
      });

      const applyMxBtn = document.createElement('button');
      applyMxBtn.className = 'icon-btn';
      applyMxBtn.innerText = 'Apply MEDIAXR';
      applyMxBtn.title = 'Apply MEDIAXR preset (name/symbol/logo)';
      applyMxBtn.addEventListener('click', () => {
        t.metadata = Object.assign({}, t.metadata || {}, MEDIAXR_PRESET);
        saveAndRefresh(tokens);
      });

      const editBtn = document.createElement('button');
      editBtn.className = 'icon-btn';
      editBtn.innerText = 'Edit';
      editBtn.addEventListener('click', () => {
        openEditModal(idx);
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'icon-btn';
      removeBtn.innerText = 'Remove';
      removeBtn.addEventListener('click', () => {
        tokens.splice(idx, 1);
        saveAndRefresh(tokens);
      });

      actions.appendChild(copyBtn);
      actions.appendChild(fetchBtn);
      actions.appendChild(applyMxBtn);
      actions.appendChild(editBtn);
      actions.appendChild(removeBtn);

      card.appendChild(top);
      card.appendChild(info);
      card.appendChild(actions);

      grid.appendChild(card);
    });
  }

  function saveAndRefresh(tokens) {
    saveTokens(tokens);
    render();
  }

  // Create token entry
  async function createTokenEntry() {
    const rawAddr = normalizeAddress(tokenInput.value);
    if (!isValidAddress(rawAddr)) {
      tokenInput.classList.add('invalid');
      tokenInput.focus();
      const prev = tokenInput.placeholder;
      tokenInput.placeholder = 'Invalid address (0x + 40 hex chars)';
      setTimeout(() => tokenInput.placeholder = prev, 1400);
      return;
    }

    const chainKey = chainSelect.value;
    const chain = CHAINS.find(c => c.key === chainKey) || { name: chainKey };
    const manualSupply = (supplyInput.value || '').trim();

    const tokenObj = {
      address: rawAddr,
      chainKey,
      chainName: chain.name,
      supplyInput: manualSupply || null,
      metadata: {},
      createdAt: new Date().toISOString()
    };

    const tokens = loadTokens();

    // dedupe by address+chain
    const exists = tokens.find(t => t.address.toLowerCase() === rawAddr.toLowerCase() && t.chainKey === chainKey);
    if (exists) {
      alert('Token already exists for the selected chain.');
      return;
    }

    // Optionally fetch on-chain metadata & totalSupply
    if (fetchOnchainCheckbox.checked) {
      try {
        const meta = await fetchOnChainMetadata(rawAddr, chainKey);
        tokenObj.metadata = Object.assign({}, tokenObj.metadata, meta);
        if ((!manualSupply || manualSupply === '') && meta.totalSupply) {
          tokenObj.supplyInput = meta.totalSupply;
        }
      } catch (e) {
        console.warn('On-chain fetch failed on create:', e);
        // continue with the entry, allow manual override later
      }
    }

    // Optionally apply MEDIAXR preset (overrides name/symbol/logo)
    if (applyMediaXrCheckbox.checked) {
      tokenObj.metadata = Object.assign({}, tokenObj.metadata || {}, MEDIAXR_PRESET);
    }

    tokens.push(tokenObj);
    saveTokens(tokens);

    tokenInput.value = '';
    supplyInput.value = '';
    // reset checkboxes? leave as-is so user can successive-create
    render();
  }

  // Simple edit modal using prompt() for name/symbol/logo/supply override
  function openEditModal(index) {
    const tokens = loadTokens();
    const t = tokens[index];
    if (!t) return;
    const name = prompt('Token name (leave blank to keep):', t.metadata && t.metadata.name ? t.metadata.name : '');
    if (name !== null && name !== '') {
      t.metadata = Object.assign({}, t.metadata || {}, { name });
    }
    const symbol = prompt('Token symbol (leave blank to keep):', t.metadata && t.metadata.symbol ? t.metadata.symbol : '');
    if (symbol !== null && symbol !== '') {
      t.metadata = Object.assign({}, t.metadata || {}, { symbol });
    }
    const logo = prompt('Token logo URL (leave blank to keep):', t.metadata && t.metadata.logo ? t.metadata.logo : '');
    if (logo !== null && logo !== '') {
      t.metadata = Object.assign({}, t.metadata || {}, { logo });
    }
    const supply = prompt('Supply (manual override, blank to keep):', t.supplyInput || '');
    if (supply !== null && supply !== '') {
      t.supplyInput = supply;
    }
    saveAndRefresh(tokens);
  }

  // Theme handling
  function setTheme(theme) {
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
    const cls = `theme-${theme || 'light'}`;
    document.body.classList.add(cls);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    themeSelect.value = theme;
  }

  // Columns handling: if 'auto' -> remove inline --columns to allow CSS breakpoints.
  function setColumns(value) {
    localStorage.setItem(STORAGE_KEYS.COLUMNS, value);
    if (value === 'auto') {
      grid.style.removeProperty('--columns');
    } else {
      const n = parseInt(value, 10) || 1;
      grid.style.setProperty('--columns', n);
    }
  }

  // Init
  function init() {
    initChains();

    // load theme
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    setTheme(savedTheme);

    // load columns
    const savedCols = localStorage.getItem(STORAGE_KEYS.COLUMNS) || '2';
    columnsSelect.value = savedCols;
    setColumns(savedCols);

    // bind
    createBtn.addEventListener('click', (e) => {
      createBtn.disabled = true;
      createTokenEntry().finally(() => createBtn.disabled = false);
    });
    tokenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') createBtn.click();
    });
    supplyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') createBtn.click();
    });

    themeSelect.addEventListener('change', (e) => {
      setTheme(e.target.value);
    });
    columnsSelect.addEventListener('change', (e) => {
      setColumns(e.target.value);
      render();
    });

    tokenInput.addEventListener('input', () => {
      tokenInput.classList.remove('invalid');
    });

    // initial render
    render();

    // Accessibility: preselect Ethereum
    chainSelect.value = 'eth';
  }

  // Convenience function to register a MEDIAXR override for a specific chain+address programmatically
  // Usage from console:
  // window.registerMediaXrOverride('eth', '0xabc...') -> applies MEDIAXR metadata to any existing entries matching that chain+address.
  window.registerMediaXrOverride = function (chainKey, address) {
    if (!isValidAddress(address)) {
      console.warn('Invalid address for override');
      return;
    }
    const tokens = loadTokens();
    const normalized = address.toLowerCase();
    let updated = false;
    for (const t of tokens) {
      if (t.chainKey === chainKey && t.address.toLowerCase() === normalized) {
        t.metadata = Object.assign({}, t.metadata || {}, MEDIAXR_PRESET);
        updated = true;
      }
    }
    if (updated) {
      saveAndRefresh(tokens);
      console.info('Metadata override applied for MEDIAXR / RXR');
    } else {
      console.info('No matching token entry found. Create one then run this function again.');
    }
  };

  // Run init on DOM ready
  document.addEventListener('DOMContentLoaded', init);

})();