// One live game room: a host, many players, one round at a time. No I/O here; the
// server owns sockets and timers and calls these methods.
import { randomBytes, randomInt } from 'node:crypto';
import { GAMES } from './games.js';

export const LIMITS = { maxPlayers: 5000, nameLen: 12, minSeconds: 10, maxSeconds: 60 };

const BOT_NAMES = ['블럭이', '용암러', '다이아', '크리퍼', '에메랄드', '워든', '럭키블럭', '레드스톤', '흑요석', '슬라임'];

export function newCode(taken) {
  for (;;) {
    const code = String(randomInt(100000, 1000000));
    if (!taken.has(code)) return code;
  }
}

export function cleanName(raw) {
  const name = String(raw ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, LIMITS.nameLen);
  return name || null;
}

export class Room {
  constructor(code, now = Date.now()) {
    this.code = code;
    this.hostKey = randomBytes(16).toString('hex');
    this.createdAt = now;
    this.players = new Map();
    this.phase = 'lobby'; // lobby | question | result
    this.round = null;
    this.roundNo = 0;
    this.answers = new Map();
    this.result = null;
    this.botSeq = 0;
    this.history = []; // one record per finished round, input for the recap workflow
  }

  join(rawName) {
    if (this.players.size >= LIMITS.maxPlayers) return { error: 'full' };
    const name = cleanName(rawName);
    if (!name) return { error: 'name' };
    const id = randomBytes(6).toString('hex');
    const token = randomBytes(12).toString('hex');
    this.players.set(id, { id, name, token, score: 0, bot: false, last: null });
    return { id, token, name };
  }

  rejoin(id, token) {
    const p = this.players.get(id);
    return p && p.token === token ? p : null;
  }

  addBots(n) {
    const room = Math.min(n, LIMITS.maxPlayers - this.players.size);
    for (let i = 0; i < room; i++) {
      const id = `bot${++this.botSeq}`;
      const name = `${BOT_NAMES[this.botSeq % BOT_NAMES.length]}${this.botSeq}`;
      this.players.set(id, { id, name, token: null, score: 0, bot: true, last: null });
    }
    return room;
  }

  start(gameId, seconds, now = Date.now(), rnd = Math.random) {
    const game = GAMES[gameId];
    if (!game || this.phase === 'question') return false;
    const secs = Math.min(LIMITS.maxSeconds, Math.max(LIMITS.minSeconds, Number(seconds) || 20));
    const players = [...this.players.values()];
    this.round = { game: gameId, endsAt: now + secs * 1000, ...game.setup(players, rnd) };
    this.roundNo++;
    this.phase = 'question';
    this.answers = new Map();
    this.result = null;
    for (const p of players) if (p.bot) this.answers.set(p.id, game.bot(this.round, rnd));
    return true;
  }

  answer(id, value, now = Date.now()) {
    if (this.phase !== 'question' || now > this.round.endsAt) return 'closed';
    const p = this.players.get(id);
    if (!p || p.bot) return 'unknown';
    if (this.answers.has(id)) return 'already';
    const v = GAMES[this.round.game].accept(value);
    if (v === null) return 'invalid';
    this.answers.set(id, v);
    return 'ok';
  }

  allAnswered() {
    return this.answers.size >= this.players.size;
  }

  finish() {
    if (this.phase !== 'question') return null;
    const players = [...this.players.values()];
    const { deltas, notes, summary } = GAMES[this.round.game].score(this.round, this.answers, players);
    for (const p of players) {
      const delta = deltas.get(p.id) ?? 0;
      p.score += delta;
      p.last = { delta, answer: this.answers.get(p.id) ?? null, note: notes?.get(p.id) ?? null };
    }
    this.phase = 'result';
    this.result = { game: this.round.game, summary };
    const { partner, endsAt, ...params } = this.round;
    this.history.push({ roundNo: this.roundNo, ...params, players: players.length, answered: this.answers.size, summary });
    return this.result;
  }

  // Everything the recap needs, with no player tokens or ids.
  session() {
    return { code: this.code, startedAt: this.createdAt, players: this.players.size, rounds: this.history, top: this.leaderboard(3) };
  }

  leaderboard(n = 10) {
    return [...this.players.values()]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, n)
      .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score, bot: p.bot }));
  }

  // Competition ranking (ties share a rank), computed once per broadcast.
  ranks() {
    const sorted = [...this.players.values()].sort((a, b) => b.score - a.score);
    const out = new Map();
    sorted.forEach((p, i) => out.set(p.id, i && p.score === sorted[i - 1].score ? out.get(sorted[i - 1].id) : i + 1));
    return out;
  }

  // What every screen sees. Answers stay hidden until the round ends.
  publicState() {
    const r = this.round;
    return {
      code: this.code,
      phase: this.phase,
      roundNo: this.roundNo,
      players: this.players.size,
      answered: this.answers.size,
      round: r && {
        game: r.game,
        title: GAMES[r.game].title,
        endsAt: r.endsAt,
        pot: r.pot,
        max: r.max,
        prize: r.prize,
        jamo: r.jamo,
        topic: r.topic,
      },
      result: this.result,
      leaderboard: this.leaderboard(10),
    };
  }

  // What one player sees on top of the public state.
  privateState(id, ranks = this.ranks()) {
    const p = this.players.get(id);
    if (!p) return null;
    const partnerId = this.round?.partner?.[id];
    return {
      id,
      name: p.name,
      score: p.score,
      rank: ranks.get(id),
      answered: this.answers.has(id),
      partner: partnerId === undefined ? undefined : partnerId ? this.players.get(partnerId)?.name : null,
      last: this.phase === 'result' ? p.last : null,
    };
  }
}
