// Load test: one host plus N real WebSocket players play one round.
// node scripts/load.js [baseUrl] [players]   e.g. node scripts/load.js http://localhost:3000 2000
import WebSocket from 'ws';

const base = (process.argv[2] || 'http://localhost:3000').replace(/^http/, 'ws') + '/ws';
const N = Number(process.argv[3]) || 1000;
const open = (onMsg) => new Promise((resolve, reject) => {
  const ws = new WebSocket(base);
  ws.on('message', (d) => onMsg(JSON.parse(d), ws));
  ws.on('open', () => resolve(ws));
  ws.on('error', reject);
});
const pct = (arr, p) => arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];

let code;
const hostReady = new Promise((resolve) => {
  open((m) => { if (m.t === 'host') { code = m.code; resolve(); } }).then((ws) => {
    globalThis.host = ws;
    ws.send(JSON.stringify({ t: 'host:create' }));
  });
});
await hostReady;

const t0 = Date.now();
const joinMs = [];
const ackMs = [];
const resultMs = [];
let startAt = 0;
let answered = 0;
const players = [];
for (let i = 0; i < N; i += 100) {
  await Promise.all(Array.from({ length: Math.min(100, N - i) }, (_, k) => {
    const sent = Date.now();
    let sentAnswer = 0;
    return new Promise((done) => {
      open((m, ws) => {
        if (m.t === 'joined') { joinMs.push(Date.now() - sent); done(); }
        if (m.t === 'state' && m.state.phase === 'question' && !sentAnswer) {
          sentAnswer = Date.now();
          ws.send(JSON.stringify({ t: 'answer', value: Math.floor(Math.random() * 101) }));
        }
        if (m.t === 'ack') { ackMs.push(Date.now() - sentAnswer); answered++; }
        if (m.t === 'state' && m.state.phase === 'result') resultMs.push(Date.now() - startAt);
      }).then((ws) => { players.push(ws); ws.send(JSON.stringify({ t: 'join', code, name: `load${i + k}` })); });
    });
  }));
}
const joinTotal = Date.now() - t0;

startAt = Date.now();
globalThis.host.send(JSON.stringify({ t: 'host:start', game: 'greed', seconds: 60 }));
const deadline = Date.now() + 70_000;
while (resultMs.length < N && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));

const report = {
  players: N,
  joinAllMs: joinTotal,
  joinP50: pct(joinMs, 50), joinP99: pct(joinMs, 99),
  answered,
  ackP50: pct(ackMs, 50), ackP99: pct(ackMs, 99),
  resultReceived: resultMs.length,
  roundDoneP50: pct(resultMs, 50), roundDoneP99: pct(resultMs, 99),
};
console.log(JSON.stringify(report, null, 2));
process.exit(report.resultReceived === N ? 0 : 1);
