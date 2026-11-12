// Round rules. Each game is pure: setup() makes the round, accept() cleans one answer,
// score() turns all answers into points. Points only; there is no money and no paid entry.
import { FORBIDDEN_CHOICES, checkAnswer } from './hangul.js';

const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];
const clampInt = (v, lo, hi) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

const TOPICS = [
  '좋아하는 음식', '가 보고 싶은 나라', '마인크래프트 몹', '학교에 있는 물건', '동물 이름',
  '편의점에서 사는 것', '과일이나 채소', '게임 아이템', '여름에 생각나는 것', '직업 이름',
];

export const GAMES = {
  // "욕심내지 않으면 돈을 드립니다": everyone gets their claim only if the total fits the pot.
  greed: {
    title: '욕심 게임',
    setup: (players) => ({ pot: 50 * Math.max(players.length, 1), max: 100 }),
    accept: (v) => clampInt(v, 0, 100),
    bot: (round, rnd = Math.random) => Math.round(20 + rnd() * 70),
    score(round, answers, players) {
      const total = players.reduce((s, p) => s + (answers.get(p.id) ?? 0), 0);
      const success = total <= round.pot;
      const deltas = new Map(players.map((p) => [p.id, success ? answers.get(p.id) ?? 0 : 0]));
      const hist = histogram(players.map((p) => answers.get(p.id) ?? 0), 0, 100, 10);
      return { deltas, summary: { total, pot: round.pot, success, hist } };
    },
  },

  // "서로를 신뢰한다면": random pairs choose split or steal.
  trust: {
    title: '신뢰 게임',
    setup(players, rnd = Math.random) {
      const ids = shuffle(players.map((p) => p.id), rnd);
      const partner = {};
      for (let i = 0; i + 1 < ids.length; i += 2) {
        partner[ids[i]] = ids[i + 1];
        partner[ids[i + 1]] = ids[i];
      }
      // An odd player out faces the house, which always splits.
      if (ids.length % 2) partner[ids.at(-1)] = null;
      return { partner };
    },
    accept: (v) => (v === 'split' || v === 'steal' ? v : null),
    bot: (round, rnd = Math.random) => (rnd() < 0.6 ? 'split' : 'steal'),
    score(round, answers, players) {
      const deltas = new Map();
      let split = 0;
      let steal = 0;
      for (const p of players) {
        const mine = answers.get(p.id) ?? 'split';
        const other = round.partner[p.id] ? answers.get(round.partner[p.id]) ?? 'split' : 'split';
        mine === 'split' ? split++ : steal++;
        const pts = mine === 'split' ? (other === 'split' ? 50 : 0) : (other === 'split' ? 100 : 0);
        deltas.set(p.id, pts);
      }
      return { deltas, summary: { split, steal } };
    },
  },

  // "옆사람보다 적게": the lowest number nobody else picked wins.
  lowest: {
    title: '유일한 최소 숫자',
    setup: () => ({ max: 100, prize: 300 }),
    accept: (v) => clampInt(v, 1, 100),
    bot: (round, rnd = Math.random) => 1 + Math.floor(rnd() * rnd() * 30),
    score(round, answers, players) {
      const counts = new Map();
      for (const v of answers.values()) counts.set(v, (counts.get(v) ?? 0) + 1);
      const unique = [...counts].filter(([, c]) => c === 1).map(([v]) => v);
      const win = unique.length ? Math.min(...unique) : null;
      const deltas = new Map(players.map((p) => [p.id, answers.get(p.id) === win ? round.prize : 0]));
      const winner = players.find((p) => answers.get(p.id) === win);
      const top = [...counts].sort((a, b) => a[0] - b[0]).slice(0, 15);
      return { deltas, summary: { win, winner: winner?.name ?? null, top } };
    },
  },

  // "ㄹ을 말하지 않으면 10만원": answer the topic without spelling the forbidden consonant.
  // A unique valid answer scores 100; a valid answer someone else also gave scores 30.
  jamo: {
    title: '금지 자음',
    setup: (players, rnd = Math.random) => ({ jamo: pick(FORBIDDEN_CHOICES, rnd), topic: pick(TOPICS, rnd) }),
    accept: (v) => (typeof v === 'string' && v.length <= 60 ? v : null),
    bot: (round, rnd = Math.random) => pick(['바나나', '사과', '토마토', '피자', '하마', '치킨', '김밥', '우주'], rnd),
    score(round, answers, players) {
      const checked = new Map();
      for (const p of players) {
        if (answers.has(p.id)) checked.set(p.id, checkAnswer(answers.get(p.id), round.jamo));
      }
      const seen = new Map();
      for (const c of checked.values()) if (c.ok) seen.set(c.normalized, (seen.get(c.normalized) ?? 0) + 1);
      const deltas = new Map();
      const notes = new Map();
      let ok = 0;
      let out = 0;
      for (const p of players) {
        const c = checked.get(p.id);
        if (!c) { deltas.set(p.id, 0); notes.set(p.id, 'none'); continue; }
        if (!c.ok) { deltas.set(p.id, 0); notes.set(p.id, c.reason); out++; continue; }
        ok++;
        const dup = seen.get(c.normalized) > 1;
        deltas.set(p.id, dup ? 30 : 100);
        notes.set(p.id, dup ? 'duplicate' : 'unique');
      }
      const popular = [...seen].sort((a, b) => b[1] - a[1]).slice(0, 8);
      return { deltas, notes, summary: { ok, out, popular } };
    },
  },
};

export function histogram(values, lo, hi, buckets) {
  const out = Array(buckets).fill(0);
  const w = (hi - lo + 1) / buckets;
  for (const v of values) out[Math.min(buckets - 1, Math.floor((v - lo) / w))]++;
  return out;
}

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
