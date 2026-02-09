export { MoltHub };

export default {
  async fetch(request, env) {
    const id = env.MOLT_DO.idFromName("main");
    const stub = env.MOLT_DO.get(id);
    const resp = await stub.fetch(request);
    return cors(resp);
  },
};

function cors(resp) {
  const headers = new Headers(resp.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

class MoltHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.worldClients = new Map(); // id -> ws
    this.lastWorld = null;
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
    const data = await request.text();
    this.lastWorld = data;
    for (const ws of this.worldClients.values()) {
      if (ws.readyState === 1) ws.send(data);
    }
    return new Response("ok");
  }

  handleWebSocket(request, url) {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    if (url.pathname === "/ws/world") {
      const id = String(this.nextId++);
      this.worldClients.set(id, server);
      server.addEventListener("close", () => this.worldClients.delete(id));
      server.addEventListener("error", () => this.worldClients.delete(id));
      if (this.lastWorld && server.readyState === 1) {
        server.send(this.lastWorld);
      }
      return new Response(null, { status: 101, webSocket: client });
    }

    server.close();
    return new Response("bad path", { status: 404 });
  }
}
