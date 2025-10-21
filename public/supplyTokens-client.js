// supplyTokens-client.js — client that uses server API endpoints
(function(){
  const API_BASE = ''; 
  const CHAINS = [
    { key: 'eth', name: 'Ethereum Mainnet' },
    { key: 'polygon', name: 'Polygon Mainnet' },
    { key: 'bsc', name: 'BSC Mainnet' },
    { key: 'avalanche', name: 'Avalanche C-Chain' },
    { key: 'fantom', name: 'Fantom Opera' },
    { key: 'arbitrum', name: 'Arbitrum One' },
    { key: 'optimism', name: 'Optimism' },
    { key: 'base', name: 'Base' },
    { key: 'zksync', name: 'zkSync Era' },
    { key: 'celo', name: 'Celo' }
    // add more client-visible chain options as desired
  ];

  const tokenInput = document.getElementById('token-input');
  const createBtn = document.getElementById('create-btn');
  const grid = document.getElementById('tokens-grid');
  const chainSelect = document.getElementById('chain-select');
  const supplyInput = document.getElementById('supply-input');
  const fetchOnchainCheckbox = document.getElementById('fetch-onchain');
  const applyMediaXrCheckbox = document.getElementById('apply-mediaxr');
  const themeSelect = document.getElementById('theme-select');
  const columnsSelect = document.getElementById('columns-select');

  function isValidAddress(addr){ return /^0x[a-fA-F0-9]{40}$/.test((addr||'').trim()); }

  function initChains(){ CHAINS.forEach(c => { const opt = document.createElement('option'); opt.value = c.key; opt.textContent = c.name; chainSelect.appendChild(opt); }); }

  async function loadTokens(){
    const r = await fetch(API_BASE + '/api/tokens');
    if (!r.ok) { grid.innerHTML = '<div class="small">Failed to load tokens from server.</div>'; return []; }
    return await r.json();
  }

  function renderTokens(tokens){
    grid.innerHTML = '';
    if (!tokens || tokens.length === 0) { grid.innerHTML = '<div class="small">No tokens yet — create token entries using the form above.</div>'; return; }
    tokens.forEach(t => {
      const card = document.createElement('div'); card.className='token-card';
      const top = document.createElement('div'); top.className='token-row';
      const left = document.createElement('div'); left.style.display='flex'; left.style.gap='10px'; left.style.alignItems='center';
      if (t.metadata && t.metadata.logo){ const img = document.createElement('img'); img.className='token-logo'; img.src = t.metadata.logo; img.alt = t.metadata.symbol || 'logo'; left.appendChild(img); }
      const metaWrap = document.createElement('div'); metaWrap.className='meta-text'; const title = document.createElement('div'); title.className='meta-title'; title.textContent = (t.metadata && t.metadata.name) ? t.metadata.name : (t.metadata && t.metadata.symbol) ? t.metadata.symbol : '(unknown)'; const sub = document.createElement('div'); sub.className='meta-sub'; sub.textContent = `${t.chainName || t.chainKey} • ${t.metadata && t.metadata.symbol ? t.metadata.symbol : '(?)'}`; metaWrap.appendChild(title); metaWrap.appendChild(sub); left.appendChild(metaWrap);
      const addr = document.createElement('div'); addr.className='token-address'; addr.textContent = t.address;
      top.appendChild(left); top.appendChild(addr);
      const info = document.createElement('div'); info.className='small'; info.innerHTML = `Supply (entered): ${t.supplyInput ? t.supplyInput : '<i>not set</i>'}`;
      if (t.metadata && t.metadata.totalSupply){ const onchain = document.createElement('div'); onchain.className='small'; onchain.innerHTML = `<strong>On-chain totalSupply:</strong> ${t.metadata.totalSupply} (decimals: ${t.metadata.decimals||'n/a'})`; info.appendChild(document.createElement('br')); info.appendChild(onchain); }
      const actions = document.createElement('div'); actions.className='token-actions';
      const copyBtn = document.createElement('button'); copyBtn.className='icon-btn'; copyBtn.innerText='Copy'; copyBtn.addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText(t.address); copyBtn.innerText='Copied'; setTimeout(()=>copyBtn.innerText='Copy',900);}catch{} });
      const refreshBtn = document.createElement('button'); refreshBtn.className='icon-btn'; refreshBtn.innerText='Refresh'; refreshBtn.addEventListener('click', async ()=>{ refreshBtn.disabled=true; refreshBtn.innerText='Refreshing...'; try{ const resp = await fetch(API_BASE + '/api/tokens/' + t.id + '/refresh', { method: 'POST' }); if (!resp.ok) throw new Error('refresh failed'); await loadAndRender(); }catch(e){ alert('Refresh failed: '+e.message);} finally{ refreshBtn.disabled=false; refreshBtn.innerText='Refresh'; } });
      const applyMxBtn = document.createElement('button'); applyMxBtn.className='icon-btn'; applyMxBtn.innerText='Apply MEDIAXR'; applyMxBtn.addEventListener('click', async ()=>{ await fetch(API_BASE + '/api/tokens/' + t.id, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ metadata: { name: 'MEDIAXR', symbol: 'RXR', logo: 'https://musicchain.netlify.app/android-chrome-512x512.png' } }) }); await loadAndRender(); });
      const deleteBtn = document.createElement('button'); deleteBtn.className='icon-btn'; deleteBtn.innerText='Remove'; deleteBtn.addEventListener('click', async ()=>{ if (!confirm('Remove token?')) return; await fetch(API_BASE + '/api/tokens/' + t.id, { method: 'DELETE' }); await loadAndRender(); });
      actions.appendChild(copyBtn); actions.appendChild(refreshBtn); actions.appendChild(applyMxBtn); actions.appendChild(deleteBtn);
      card.appendChild(top); card.appendChild(info); card.appendChild(actions); grid.appendChild(card);
    });
  }

  async function loadAndRender(){ const tokens = await loadTokens(); renderTokens(tokens); }

  async function createTokenEntry(){ const rawAddr = (tokenInput.value||'').trim(); if(!isValidAddress(rawAddr)){ alert('Invalid address'); return; } const chainKey = chainSelect.value; const chain = CHAINS.find(c=>c.key===chainKey)||{name:chainKey}; const manualSupply = (supplyInput.value||'').trim(); const body = { address: rawAddr, chainKey, chainName: chain.name, supplyInput: manualSupply, fetchOnchain: fetchOnchainCheckbox.checked, applyMediaXr: applyMediaXrCheckbox.checked };
    createBtn.disabled=true; try{ const r = await fetch(API_BASE + '/api/tokens', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); if (!r.ok){ const txt = await r.text(); throw new Error(txt||'create failed'); } tokenInput.value=''; supplyInput.value=''; await loadAndRender(); }catch(e){ alert('Create failed: '+(e.message||e)); } finally{ createBtn.disabled=false; } }

  function setTheme(theme){ document.body.classList.remove('theme-light','theme-dark','theme-sepia'); document.body.classList.add('theme-'+(theme||'light')); localStorage.setItem('supply_theme_v3', theme); themeSelect.value=theme; }
  function setColumns(value){ localStorage.setItem('supply_columns_v3', value); const gridEl = document.getElementById('tokens-grid'); if(value==='auto') gridEl.style.removeProperty('--columns'); else gridEl.style.setProperty('--columns', parseInt(value,10)||1); }

  function init(){ initChains(); createBtn.addEventListener('click', createTokenEntry); tokenInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter') createBtn.click(); }); supplyInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter') createBtn.click(); }); themeSelect.addEventListener('change',(e)=>setTheme(e.target.value)); columnsSelect.addEventListener('change',(e)=>{ setColumns(e.target.value); loadAndRender(); }); tokenInput.addEventListener('input', ()=> tokenInput.classList.remove('invalid')); const savedTheme = localStorage.getItem('supply_theme_v3')||'light'; setTheme(savedTheme); const savedCols = localStorage.getItem('supply_columns_v3')||'2'; columnsSelect.value=savedCols; setColumns(savedCols); loadAndRender(); chainSelect.value='eth'; }

  document.addEventListener('DOMContentLoaded', init);
})();
