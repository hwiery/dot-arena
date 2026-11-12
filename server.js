// HTTP + WebSocket server. Rooms live in memory on one instance (see docs/TECH.md for scaling).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { Room, newCode } from './src/room.js';
import { GAMES } from './src/games.js';
import { runRecap } from './src/recap-runner.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 2000;
const ROOM_IDLE_MS = 3 * 60 * 60 * 1000;
const HOST_FLUSH_MS = 300;
const MSG_PER_SEC = 10;
const VERSION = process.env.RENDER_GIT_COMMIT?.slice(0, 7) || 'dev';

const recaps = new Map(); // id -> { svg, recap, via }, newest last
const MAX_RECAPS = 500;
const rooms = new Map(); // code -> { room, hosts:Set<ws>, players:Map<id, ws>, timer, dirty, touched }
const stats = { started: Date.now(), roomsCreated: 0, joins: 0, rounds: 0, messages: 0, dropped: 0 };
const lag = monitorEventLoopDelay({ resolution: 20 });
lag.enable();

const log = (event, data = {}) => console.log(JSON.stringify({ t: new Date().toISOString(), event, ...data }));

// ---------- HTTP ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
const ROUTES = { '/': 'index.html', '/host': 'host.html', '/play': 'play.html' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return res.end(JSON.stringify({ ok: true, version: VERSION, rooms: rooms.size, uptime: Math.round(process.uptime()) }));
  }
  if (url.pathname === '/metrics') {
    res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4' });
    return res.end(metrics());
  }
  const recap = url.pathname.match(/^\/recap\/([a-f0-9]{16})(\.svg)?$/);
  if (recap) return serveRecap(res, recaps.get(recap[1]), recap[1], Boolean(recap[2]));
  const file = ROUTES[url.pathname] ?? normalize(url.pathname).replace(/^(\.\.[/\\])+/, '').slice(1);
  try {
    const body = await readFile(join(PUBLIC, file));
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

function serveRecap(res, r, id, svg) {
  if (!r) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
  if (svg) { res.writeHead(200, { 'content-type': 'image/svg+xml' }); return res.end(r.svg); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dot Arena 리캡</title><link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css"></head><body><div class="wrap narrow">
<div class="brand"><i></i>Dot Arena</div><p class="muted">만든 곳: ${r.via === 'render-workflows' ? `Render Workflows (run ${r.runId ?? ''})` : '서버 내부(로컬 대체 경로)'}</p>
<img src="/recap/${id}.svg" alt="방송 리캡 카드" style="width:100%;border-radius:14px">
<p><a class="btn" href="/recap/${id}.svg" download="dot-arena-recap.svg">카드 내려받기 (1080×1920)</a></p></div></body></html>`);
}

function metrics() {
  let players = 0;
  let sockets = 0;
  for (const r of rooms.values()) {
    players += r.room.players.size;
    sockets += r.hosts.size + r.players.size;
  }
  const lines = [
    ['dot_rooms', rooms.size], ['dot_players', players], ['dot_sockets', sockets],
    ['dot_rooms_created_total', stats.roomsCreated], ['dot_joins_total', stats.joins],
    ['dot_rounds_total', stats.rounds], ['dot_messages_total', stats.messages],
    ['dot_messages_dropped_total', stats.dropped],
    ['dot_event_loop_lag_p99_ms', (lag.percentile(99) / 1e6).toFixed(2)],
    ['dot_heap_used_bytes', process.memoryUsage().heapUsed],
  ];
  return lines.map(([k, v]) => `${k} ${v}`).join('\n') + '\n';
}

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 1024 });

wss.on('connection', (ws) => {
  ws.alive = true;
  ws.bucket = { tokens: MSG_PER_SEC, at: Date.now() };
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (buf) => {
    stats.messages++;
    if (!allow(ws)) { stats.dropped++; return; }
    let msg;
    try { msg = JSON.parse(buf); } catch { return; }
    if (msg && typeof msg.t === 'string') handle(ws, msg);
  });
  ws.on('close', () => detach(ws));
});

function allow(ws) {
  const now = Date.now();
  const b = ws.bucket;
  b.tokens = Math.min(MSG_PER_SEC, b.tokens + ((now - b.at) / 1000) * MSG_PER_SEC);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

const send = (ws, msg) => { if (ws.readyState === 1) ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); };

function handle(ws, msg) {
  switch (msg.t) {
    case 'host:create': {
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'error', code: 'busy' });
      const room = new Room(newCode(rooms));
      rooms.set(room.code, { room, hosts: new Set(), players: new Map(), timer: null, dirty: false, touched: Date.now() });
      stats.roomsCreated++;
      log('room.create', { code: room.code });
      attachHost(ws, room.code);
      return send(ws, { t: 'host', code: room.code, hostKey: room.hostKey });
    }
    case 'host:resume': {
      const entry = rooms.get(String(msg.code));
      if (!entry || entry.room.hostKey !== msg.hostKey) return send(ws, { t: 'error', code: 'no-room' });
      attachHost(ws, entry.room.code);
      return send(ws, { t: 'host', code: entry.room.code, hostKey: entry.room.hostKey });
    }
    case 'join': {
      const entry = rooms.get(String(msg.code));
      if (!entry) return send(ws, { t: 'error', code: 'no-room' });
      const res = entry.room.join(msg.name);
      if (res.error) return send(ws, { t: 'error', code: res.error });
      stats.joins++;
      attachPlayer(ws, entry, res.id);
      send(ws, { t: 'joined', code: entry.room.code, id: res.id, token: res.token, name: res.name });
      return pushPlayer(entry, res.id);
    }
    case 'rejoin': {
      const entry = rooms.get(String(msg.code));
      const p = entry?.room.rejoin(msg.id, msg.token);
      if (!p) return send(ws, { t: 'error', code: 'no-room' });
      attachPlayer(ws, entry, p.id);
      send(ws, { t: 'joined', code: entry.room.code, id: p.id, token: p.token, name: p.name });
      return pushPlayer(entry, p.id);
    }
    case 'answer': {
      const entry = rooms.get(ws.code);
      if (!entry || !ws.playerId) return;
      const r = entry.room.answer(ws.playerId, msg.value);
      send(ws, { t: 'ack', result: r });
      if (r === 'ok') {
        markDirty(entry);
        if (entry.room.allAnswered()) endRound(entry);
      }
      return;
    }
  }
  // Host-only commands below.
  const entry = ws.isHost ? rooms.get(ws.code) : null;
  if (!entry) return;
  entry.touched = Date.now();
  switch (msg.t) {
    case 'host:start': {
      if (!GAMES[msg.game] || !entry.room.start(msg.game, msg.seconds)) return;
      clearTimeout(entry.timer);
      entry.timer = setTimeout(() => endRound(entry), entry.room.round.endsAt - Date.now() + 250);
      log('round.start', { code: entry.room.code, game: msg.game, players: entry.room.players.size });
      return broadcastAll(entry);
    }
    case 'host:end':
      return endRound(entry);
    case 'host:recap': {
      const session = entry.room.session();
      if (!session.rounds.length) return send(ws, { t: 'error', code: 'no-rounds' });
      log('recap.start', { code: session.code, rounds: session.rounds.length });
      runRecap(session, log).then((r) => {
        const id = randomBytes(8).toString('hex');
        recaps.set(id, r);
        if (recaps.size > MAX_RECAPS) recaps.delete(recaps.keys().next().value);
        log('recap.done', { code: session.code, via: r.via });
        send(ws, { t: 'recap', url: `/recap/${id}`, via: r.via });
      });
      return;
    }
    case 'host:bots': {
      entry.room.addBots(Math.min(500, Math.max(1, Number(msg.n) || 0)));
      return broadcastAll(entry);
    }
  }
}

function endRound(entry) {
  clearTimeout(entry.timer);
  const res = entry.room.finish();
  if (!res) return;
  stats.rounds++;
  log('round.end', { code: entry.room.code, game: res.game, players: entry.room.players.size, answered: entry.room.answers.size });
  broadcastAll(entry);
}

function attachHost(ws, code) {
  detach(ws);
  const entry = rooms.get(code);
  ws.code = code;
  ws.isHost = true;
  entry.hosts.add(ws);
  send(ws, { t: 'state', state: entry.room.publicState() });
}

function attachPlayer(ws, entry, id) {
  detach(ws);
  ws.code = entry.room.code;
  ws.playerId = id;
  const old = entry.players.get(id);
  if (old && old !== ws) { old.playerId = null; old.close(4000, 'replaced'); }
  entry.players.set(id, ws);
  entry.touched = Date.now();
  markDirty(entry);
}

function detach(ws) {
  const entry = ws.code && rooms.get(ws.code);
  if (entry) {
    entry.hosts.delete(ws);
    if (ws.playerId && entry.players.get(ws.playerId) === ws) entry.players.delete(ws.playerId);
  }
  ws.code = ws.playerId = null;
  ws.isHost = false;
}

function pushPlayer(entry, id, pub = JSON.stringify(entry.room.publicState()), ranks) {
  const ws = entry.players.get(id);
  if (ws) send(ws, `{"t":"state","state":${pub},"me":${JSON.stringify(entry.room.privateState(id, ranks))}}`);
}

// Phase changes go to everyone; in between, only host screens get the live answer count.
function broadcastAll(entry) {
  const pub = JSON.stringify(entry.room.publicState());
  const ranks = entry.room.ranks();
  for (const ws of entry.hosts) send(ws, `{"t":"state","state":${pub}}`);
  for (const id of entry.players.keys()) pushPlayer(entry, id, pub, ranks);
  entry.dirty = false;
}

function markDirty(entry) { entry.dirty = true; }

setInterval(() => {
  for (const entry of rooms.values()) {
    if (!entry.dirty) continue;
    entry.dirty = false;
    const msg = JSON.stringify({ t: 'state', state: entry.room.publicState() });
    for (const ws of entry.hosts) send(ws, msg);
  }
}, HOST_FLUSH_MS).unref();

// Drop dead sockets and rooms nobody has touched for a while.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const [code, entry] of rooms) {
    if (now - entry.touched > ROOM_IDLE_MS && entry.hosts.size === 0) {
      clearTimeout(entry.timer);
      rooms.delete(code);
      log('room.expire', { code });
    }
  }
}, 30_000).unref();

// Render sends SIGTERM before replacing an instance; tell clients to reconnect.
process.on('SIGTERM', () => {
  log('shutdown', { rooms: rooms.size });
  for (const ws of wss.clients) send(ws, { t: 'restarting' });
  server.close();
  setTimeout(() => process.exit(0), 2000).unref();
});

server.listen(PORT, () => log('listen', { port: PORT, version: VERSION }));
