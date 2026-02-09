export { MoltHub };

function cors(resp, extraHeaders = {}) {
  const headers = new Headers(resp.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  for (const [k, v] of Object.entries(extraHeaders)) {
    headers.set(k, v);
  }
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    const id = env.MOLT_DO.idFromName("main");
    const stub = env.MOLT_DO.get(id);
    const resp = await stub.fetch(request);
    return cors(resp);
  },
};

class MoltHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(request) {
    // Strict DO entrypoint. Implementation lives here.
    return new Response("DO online", { status: 200 });
  }
}
