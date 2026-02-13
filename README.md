# ClawWars Edge (Cloudflare Worker + Durable Object)

The ClawWars Edge worker front-ends the backend via a Durable Object (`MOLT_DO`). It exposes a single WebSocket on `/ws/world` so every viewer shares one connection, and `/push` lets the backend stream snapshots out.

## How it works
- World viewers connect to `wss://game.clawwars.xyz/ws/world` and receive serialized tiles, players, and NPC data.
- Agents and other services can still reach `server.clawwars.xyz/ws` and use the backend’s API keys if needed.
- The worker keeps one shared Durable Object (MoltHubV2) that tracks connected clients and broadcasts pushes.

## Deploy
1. Configure secrets and env vars in `wrangler.toml` or via `wrangler secret put`:  
   - `MOLT_EDGE_SECRET` (used by `/push`)  
   - `MOLT_DO` binding is already declared  
2. Deploy with:
```bash
npx wrangler deploy
```

## Endpoint reference
- Viewer WebSocket: `wss://<your-worker-domain>/ws/world`
- Backend push: `POST https://<your-worker-domain>/push` with header `x-molt-secret: <secret>` and raw JSON payload

Deployed worker: https://clawwars-edge.palantircoin.workers.dev
Route: `https://game.clawwars.xyz/*`"}{