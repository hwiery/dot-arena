// Turns a finished session into a recap: one headline per round plus a 1080x1920 card
// (Shorts format) the creator can drop into the next video. Pure functions, so the same
// code runs inside the Render Workflow and as the local fallback.

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

export function analyzeRound(r) {
  const s = r.summary;
  switch (r.game) {
    case 'greed':
      return {
        game: r.game, title: '욕심 게임',
        stat: `${pct(s.total, s.pot)}%`,
        line: s.success
          ? `한도 ${s.pot}점 중 ${s.total}점만 가져갔다. 전원 성공!`
          : `한도 ${s.pot}점인데 ${s.total}점을 원했다. 전원 0점.`,
      };
    case 'trust': {
      const n = s.split + s.steal;
      return {
        game: r.game, title: '신뢰 게임',
        stat: `${pct(s.steal, n)}%`,
        line: `${n}명 중 ${s.steal}명이 짝을 배신하고 독식을 골랐다.`,
      };
    }
    case 'lowest':
      return {
        game: r.game, title: '유일한 최소 숫자',
        stat: s.win ? String(s.win) : '없음',
        line: s.win ? `아무도 안 고른 가장 작은 숫자는 ${s.win}. 우승 ${s.winner}.` : '모든 숫자가 겹쳐서 우승자가 없다.',
      };
    case 'jamo':
      return {
        game: r.game, title: `금지 자음 ${r.jamo}`,
        stat: `${pct(s.out, s.ok + s.out)}%`,
        line: `"${r.topic}"에서 ${s.out}명이 ${r.jamo}을 써서 탈락.${s.popular[0] ? ` 최다 답은 "${s.popular[0][0]}".` : ''}`,
      };
    default:
      return { game: r.game, title: r.game, stat: '', line: '' };
  }
}

export function buildRecap(session, headlines = session.rounds.map(analyzeRound)) {
  return {
    code: session.code,
    players: session.players,
    rounds: session.rounds.length,
    headlines,
    top: session.top,
    // The round that surprised most: biggest betrayal, worst greed, highest knockout rate.
    best: headlines.filter((h) => h.stat.endsWith('%')).sort((a, b) => parseInt(b.stat, 10) - parseInt(a.stat, 10))[0] ?? null,
  };
}

// Splits a line into at most `max` chunks of `width` characters for SVG text rows.
export function wrap(text, width, max = 2) {
  const out = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    if (line && (line + ' ' + word).length > width) { out.push(line); line = word; } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  if (out.length > max) out.splice(max - 1, out.length, `${out.slice(max - 1).join(' ').slice(0, width - 1)}…`);
  return out;
}

const x = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function recapSvg(recap) {
  const rows = recap.headlines.slice(0, 5).map((h, i) => {
    const y = 700 + i * 225;
    const lines = wrap(h.line, 28).map((l, k) => `<tspan x="120" dy="${k ? 44 : 0}">${x(l)}</tspan>`).join('');
    return `
  <rect x="80" y="${y}" width="920" height="205" rx="28" fill="#1d1f2b" stroke="#2e3142" stroke-width="3"/>
  <text x="120" y="${y + 66}" font-size="40" fill="#9aa0b4">${x(h.title)}</text>
  <text x="960" y="${y + 80}" font-size="72" fill="#ffd23f" text-anchor="end" font-weight="700">${x(h.stat)}</text>
  <text x="120" y="${y + 128}" font-size="34" fill="#f3f4f8">${lines}</text>`;
  }).join('');
  const top = recap.top
    .map((p, i) => `<text x="${80 + i * 320}" y="1860" font-size="32" fill="#9aa0b4">${i + 1}위 <tspan fill="#f3f4f8">${x(p.name.slice(0, 8))}</tspan> ${p.score}</text>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" font-family="'Black Han Sans','Noto Sans KR',sans-serif">
  <rect width="1080" height="1920" fill="#12131a"/>
  <rect x="80" y="120" width="56" height="56" fill="#2fe0a6"/><rect x="96" y="136" width="56" height="56" fill="#ff6a2b" opacity=".9"/>
  <text x="180" y="180" font-size="56" fill="#f3f4f8">Dot Arena 방송 리캡</text>
  <text x="80" y="330" font-size="120" fill="#2fe0a6">${recap.players.toLocaleString()}명 · ${recap.rounds}판</text>
  <text x="80" y="400" font-size="44" fill="#9aa0b4">시청자가 같은 판에서 직접 고른 결과</text>
  ${recap.best ? `<text x="80" y="520" font-size="60" fill="#ffd23f">${x(recap.best.title)} ${x(recap.best.stat)}</text>
  <text x="80" y="590" font-size="38" fill="#f3f4f8">${x(wrap(recap.best.line, 30, 1)[0])}</text>` : ''}
  ${rows}
  ${top}
</svg>`;
}
