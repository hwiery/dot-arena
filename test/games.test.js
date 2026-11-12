import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, usesConsonant } from '../src/hangul.js';
import { GAMES } from '../src/games.js';
import { Room } from '../src/room.js';

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `p${i}` }));
const answers = (obj) => new Map(Object.entries(obj));

test('jamo: spelling check covers initial, final and compound consonants', () => {
  assert.equal(usesConsonant('바나나', 'ㄹ'), false);
  assert.equal(usesConsonant('라면', 'ㄹ'), true);   // initial
  assert.equal(usesConsonant('김밥', 'ㄱ'), true);   // initial
  assert.equal(usesConsonant('닭', 'ㄹ'), true);     // ㄺ final
  assert.equal(usesConsonant('닭', 'ㄱ'), true);
  assert.equal(usesConsonant('까치', 'ㄱ'), true);   // ㄲ
  assert.equal(usesConsonant('사과', 'ㅅ'), true);
});

test('jamo: answer validation', () => {
  assert.equal(checkAnswer('바나나', 'ㄹ').ok, true);
  assert.equal(checkAnswer('  피  자 ', 'ㄹ').normalized, '피 자');
  assert.equal(checkAnswer('바', 'ㄹ').reason, 'short');
  assert.equal(checkAnswer('pizza', 'ㄹ').reason, 'not-hangul');
  assert.equal(checkAnswer('ㅋㅋ', 'ㄹ').reason, 'not-hangul');
  assert.equal(checkAnswer('불고기', 'ㄹ').reason, 'forbidden');
});

test('jamo: unique answers beat duplicates', () => {
  const ps = players(3);
  const round = { jamo: 'ㄹ', topic: '음식' };
  const res = GAMES.jamo.score(round, answers({ p0: '피자', p1: '피자', p2: '김밥' }), ps);
  assert.deepEqual([...res.deltas.values()], [30, 30, 100]);
  assert.equal(res.summary.ok, 3);
});

test('greed: everyone is paid only when the total fits the pot', () => {
  const ps = players(2);
  const round = GAMES.greed.setup(ps); // pot 100
  assert.equal(round.pot, 100);
  let res = GAMES.greed.score(round, answers({ p0: 40, p1: 60 }), ps);
  assert.deepEqual([...res.deltas.values()], [40, 60]);
  res = GAMES.greed.score(round, answers({ p0: 41, p1: 60 }), ps);
  assert.deepEqual([...res.deltas.values()], [0, 0]);
  assert.equal(GAMES.greed.accept('101'), null);
  assert.equal(GAMES.greed.accept('7'), 7);
});

test('trust: split/steal payoffs and the odd player faces the house', () => {
  const ps = players(3);
  const round = GAMES.trust.setup(ps, () => 0.1);
  const paired = Object.values(round.partner).filter(Boolean).length;
  assert.equal(paired, 2);
  const solo = Object.keys(round.partner).find((id) => round.partner[id] === null);
  const [a, b] = Object.keys(round.partner).filter((id) => id !== solo);
  const res = GAMES.trust.score(round, answers({ [a]: 'steal', [b]: 'split', [solo]: 'steal' }), ps);
  assert.equal(res.deltas.get(a), 100);
  assert.equal(res.deltas.get(b), 0);
  assert.equal(res.deltas.get(solo), 100);
});

test('lowest: the lowest number nobody shares wins', () => {
  const ps = players(4);
  const res = GAMES.lowest.score({ prize: 300 }, answers({ p0: 1, p1: 1, p2: 3, p3: 2 }), ps);
  assert.equal(res.summary.win, 2);
  assert.equal(res.deltas.get('p3'), 300);
  assert.equal(res.deltas.get('p2'), 0);
});

test('room: a full round with bots, ranking and the closed window', () => {
  const room = new Room('123456', 0);
  const me = room.join('호영');
  room.addBots(9);
  assert.equal(room.players.size, 10);
  assert.ok(room.start('greed', 20, 1000, () => 0.5));
  assert.equal(room.answers.size, 9); // bots answer at once
  assert.equal(room.answer(me.id, 5, 2000), 'ok');
  assert.equal(room.answer(me.id, 6, 2000), 'already');
  assert.ok(room.allAnswered());
  room.finish();
  assert.equal(room.phase, 'result');
  assert.equal(room.players.get(me.id).last.delta, 5);
  const st = room.privateState(me.id);
  assert.equal(st.score, 5);
  assert.ok(st.rank >= 1 && st.rank <= 10);
  assert.ok(room.start('jamo', 20, 3000));
  assert.equal(room.answer(me.id, '바나나', 99_999), 'closed');
});

test('room: names are cleaned and rejoin needs the token', () => {
  const room = new Room('111111');
  assert.equal(room.join('   ').error, 'name');
  const p = room.join('<b>가나다라마바사아자차카타파</b>');
  assert.equal(p.name, 'b가나다라마바사아자차카');
  assert.equal(room.rejoin(p.id, 'wrong'), null);
  assert.ok(room.rejoin(p.id, p.token));
});

test('recap: session history becomes headlines and a Shorts-size card', async () => {
  const { buildRecap, recapSvg } = await import('../src/recap.js');
  const room = new Room('222222');
  room.join('호영');
  room.addBots(19);
  room.start('trust', 20, 0, () => 0.3);
  room.finish();
  room.start('jamo', 20, 0, () => 0.3);
  room.finish();
  const session = room.session();
  assert.equal(session.rounds.length, 2);
  assert.equal(JSON.stringify(session).includes('token'), false);
  const recap = buildRecap(session);
  assert.equal(recap.headlines[0].title, '신뢰 게임');
  assert.match(recap.headlines[1].title, /^금지 자음 /);
  assert.ok(recap.best);
  const svg = recapSvg(recap);
  assert.match(svg, /width="1080" height="1920"/);
});
