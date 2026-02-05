export { MoltHub };

export default {
  async fetch(request, env) {
    const id = env.MOLT_DO.idFromName("main");
    const stub = env.MOLT_DO.get(id);
    return stub.fetch(request);
  },
};

function cors(resp) {
  const headers = new Headers(resp.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*" );
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

class MoltHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.worldClients = new Map(); // id -> {ws, view}
    this.lastWorld = null; // full snapshot
    this.nextId = 1;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request, url);
    }
    if (url.pathname === "/push") {
      return this.handlePush(request);
    }
    return cors(new Response("not found", { status: 404 }));
  }

  async handlePush(request) {
    const secret = request.headers.get("x-molt-secret");
    if (!secret || secret !== this.env.MOLT_EDGE_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
    const data = await request.json();
    this.lastWorld = data;
    this.broadcastWorld();
    return new Response("ok");
  }

  handleWebSocket(request, url) {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    if (url.pathname === "/ws/world") {
      const id = String(this.nextId++);
      this.worldClients.set(id, { ws: server, view: null });
      server.addEventListener("message", (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'view') {
            const { x, y, w, h } = data;
            this.worldClients.set(id, { ws: server, view: { x, y, w, h } });
            this.sendView(id);
          }
        } catch {}
      });
      server.addEventListener("close", () => this.worldClients.delete(id));
      server.addEventListener("error", () => this.worldClients.delete(id));
      return new Response(null, { status: 101, webSocket: client });
    }

    server.close();
    return new Response("bad path", { status: 404 });
  }

  sendView(id) {
    const entry = this.worldClients.get(id);
    if (!entry || !entry.view || !this.lastWorld) return;
    const { ws, view } = entry;
    const W = this.lastWorld.worldWidth || this.lastWorld.worldSize;
    const H = this.lastWorld.worldHeight || this.lastWorld.worldSize;
    const x = Math.max(0, Math.min(W - 1, Math.floor(view.x)));
    const y = Math.max(0, Math.min(H - 1, Math.floor(view.y)));
    const w = Math.max(1, Math.min(W - x, Math.floor(view.w)));
    const h = Math.max(1, Math.min(H - y, Math.floor(view.h)));

    const tiles2d = [];
    const tiles = this.lastWorld.tiles || [];
    for (let yy = 0; yy < h; yy++) {
      const row = [];
      for (let xx = 0; xx < w; xx++) {
        row.push(tiles[(y + yy) * W + (x + xx)] || 0);
      }
      tiles2d.push(row);
    }

    const payload = {
      type: 'world',
      ok: true,
      worldWidth: W,
      worldHeight: H,
      x, y, w, h,
      tiles: tiles2d,
      players: this.lastWorld.players || [],
      animals: this.lastWorld.animals || [],
      npcs: this.lastWorld.npcs || [],
      chat: this.lastWorld.chat || [],
    };
    if (ws.readyState === 1) ws.send(JSON.stringify(payload));
  }

  broadcastWorld() {
    for (const id of this.worldClients.keys()) {
      this.sendView(id);
    }
  }
}
