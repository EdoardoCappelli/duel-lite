// Duel Lite relay: one Durable Object per room code forwards messages between the (at most) two players.
// Everything else is served from the static assets.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/ws\/([A-Z0-9]{4,8})$/);
    if (!m) return env.ASSETS.fetch(req);
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
  },
};

export class Room {
  constructor(ctx) {
    this.ctx = ctx;
    // keep-alive pings are answered without waking the object
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(req) {
    const cid = (new URL(req.url).searchParams.get('cid') || crypto.randomUUID()).slice(0, 40);
    // same device reconnecting (e.g. after the phone slept): drop its old socket
    for (const old of this.ctx.getWebSockets(cid)) {
      old.serializeAttachment({ replaced: true });
      try { old.close(4001, 'replaced'); } catch {}
    }
    const others = this.live().filter(ws => !this.ctx.getTags(ws).includes(cid));
    const [client, server] = Object.values(new WebSocketPair());
    if (others.length >= 2) {
      server.accept();
      server.send(JSON.stringify({ sys: 'full' }));
      server.close(4000, 'full');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server, [cid]);
    server.serializeAttachment({});
    if (others.length) for (const ws of [server, ...others]) this.sendTo(ws, { sys: 'peer' });
    return new Response(null, { status: 101, webSocket: client });
  }

  live() {
    return this.ctx.getWebSockets().filter(ws => !ws.deserializeAttachment()?.replaced && ws.readyState === 1);
  }
  sendTo(ws, m) { try { ws.send(JSON.stringify(m)); } catch {} }

  webSocketMessage(ws, msg) {
    for (const o of this.live()) if (o !== ws) try { o.send(msg); } catch {}
  }
  webSocketClose(ws, code) {
    this.left(ws);
    try { ws.close(code >= 3000 ? code : 1000, 'bye'); } catch {} // complete the close handshake
  }
  webSocketError(ws) { this.left(ws); }
  left(ws) {
    if (ws.deserializeAttachment()?.replaced) return;
    ws.serializeAttachment({ replaced: true });
    for (const o of this.live()) if (o !== ws) this.sendTo(o, { sys: 'left' });
  }
}
