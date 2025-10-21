# Supply — Multichain Server + Client

This PR adds a small Express server that provides persistent storage for token entries and performs on-chain metadata fetches server-side using prioritized RPC endpoints (supports Alchemy and Infura API keys via environment variables). It also updates the client to call the server API instead of using public RPCs directly.

Important: Do NOT commit real API keys. Use environment variables or GitHub repository secrets.

Quick start (local):

1. Copy `.env.example` to `.env` and fill in your API keys (or leave blank to rely on public endpoints):

   ALCHEMY_API_KEY=your_alchemy_key
   INFURA_PROJECT_ID=your_infura_project_id

2. Install and run:

   npm install
   npm run migrate
   npm start

3. Visit http://localhost:4000 to use the server-backed UI.

Server endpoints:
- GET /api/tokens
- POST /api/tokens
- PUT /api/tokens/:id
- DELETE /api/tokens/:id
- POST /api/tokens/:id/refresh
- POST /api/tokenlists/refresh
