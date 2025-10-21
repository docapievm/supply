```markdown
# Supply Token Manager — Multi-chain (Demo) — MEDIAXR preset + improved RPCs

What I changed
- Added robust metadata fetching (name, symbol, decimals, totalSupply) across prioritized RPC endpoints per chain.
- Added support for token logos and updated the UI to show logos when available.
- Added a MEDIAXR preset (Name = MEDIAXR, Symbol = RXR, Logo = https://musicchain.netlify.app/android-chrome-512x512.png).
  - You can apply the preset at creation time with the "Apply MEDIAXR preset" checkbox, or apply it later per entry using the "Apply MEDIAXR" button on a token card, or programmatically via window.registerMediaXrOverride(chainKey, address).
- Integrated multiple preferred RPC endpoints per chain (Cloudflare, polygon-rpc, bsc-dataseed, Avalanche public, plus Ankr as a reliable fallback) and attempt them sequentially so metadata fetches succeed more reliably than using a single endpoint.
- The UI persists token entries and settings in localStorage.

Files added/updated
- index.html — UI: added MEDIAXR preset checkbox and integrated logo display in token cards.
- styles.css — minor styles for token logo and meta layout.
- supplyTokens-multichain.js — main logic:
  - multi-rpc support (try each RPC in order).
  - fetchOnChainMetadata attempts to fetch metadata using available RPCs with timeouts and fallbacks.
  - applies MEDIAXR preset (name/symbol/logo) when requested or via exposed function.
- README.md — this file.

MEDIAXR preset
- Logo URL: https://musicchain.netlify.app/android-chrome-512x512.png
- Name: MEDIAXR
- Symbol: RXR

How metadata is determined on create
1. If "Fetch on-chain" is checked, the script attempts to read name(), symbol(), decimals(), totalSupply() from the token contract using the chain's prioritized RPC list.
2. If the MEDIAXR preset is checked, it will apply/override name/symbol/logo after any on-chain fetch (so preset takes precedence).
3. You can always edit metadata manually via the "Edit" button, or apply the MEDIAXR preset to any saved entry.

Notes & next steps you might want
- If you have API keys for Alchemy/Infura/QuickNode, add those RPC URLs at the front of the corresponding chain's rpcs array for much higher reliability.
- For production usage, move RPC keys to server-side config or environment variables and avoid embedding secrets in client-side code.
- If you want automatic logo discovery (e.g., from tokenlists, trustwallet assets, or an image CDN), I can add tokenlist/Coingecko/TrustWallet lookups and caching.

```