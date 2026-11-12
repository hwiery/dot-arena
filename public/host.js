import { $, connect, countdown, esc, toast, RULES } from './common.js';

const KEY = 'dot-host';
let saved = null;
try { saved = JSON.parse(sessionStorage.getItem(KEY)); } catch {}

const conn = connect((msg) => {
  if (msg.t === 'host') {
    saved = { code: msg.code, hostKey: msg.hostKey };
    try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch {}
    $('#code').textContent = msg.code;
    $('#joinUrl').textContent = `${location.host}/play?code=${msg.code}`;
  } else if (msg.t === 'state') {
    render(msg.state);
  } else if (msg.t === 'error') {
    if (msg.code === 'no-room') { saved = null; conn.send({ t: 'host:create' }); }
    else { $('#recap').disabled = false; toast({ 'no-rounds': '먼저 한 판 이상 진행해 주세요', busy: '서버가 붐벼요' }[msg.code] ?? msg.code); }
  } else if (msg.t === 'recap') {
    $('#recap').disabled = false;
    $('#recapLink').href = msg.url;
    $('#recapLink').classList.remove('hide');
    window.open(msg.url, '_blank');
  } else if (msg.t === 'restarting') {
    toast('서버 업데이트 중 — 잠시 후 다시 연결합니다');
  }
}, () => conn.send(saved ? { t: 'host:resume', ...saved } : { t: 'host:create' }));

document.querySelectorAll('[data-game]').forEach((b) => {
  b.onclick = () => conn.send({ t: 'host:start', game: b.dataset.game, seconds: Number($('#secs').value) });
});
$('#end').onclick = () => conn.send({ t: 'host:end' });
$('#bots').onclick = () => conn.send({ t: 'host:bots', n: 50 });
$('#recap').onclick = () => { $('#recap').disabled = true; conn.send({ t: 'host:recap' }); };

function render(s) {
  $('#count').textContent = s.players.toLocaleString();
  $('#lb').innerHTML = s.leaderboard
    .map((p) => `<li><span><b>${p.rank}</b>${esc(p.name)}${p.bot ? ' <span class="muted">봇</span>' : ''}</span><span>${p.score}</span></li>`)
    .join('') || '<li class="muted">아직 아무도 없어요</li>';

  const asking = s.phase === 'question';
  document.querySelectorAll('[data-game]').forEach((b) => { b.disabled = asking; });
  $('#end').disabled = !asking;
  $('#timer').classList.toggle('hide', !asking);
  $('#progress').classList.toggle('hide', !asking);
  if (!s.round) return;

  $('#title').textContent = `${s.roundNo}라운드 · ${s.round.title}`;
  $('#rule').innerHTML = RULES[s.round.game](s.round);
  if (asking) {
    countdown($('#timer'), s.round.endsAt);
    $('#answered').textContent = `${s.answered.toLocaleString()} / ${s.players.toLocaleString()} 명 제출`;
    $('#answeredBar').style.width = `${s.players ? (100 * s.answered) / s.players : 0}%`;
    $('#result').innerHTML = '';
  } else if (s.result) {
    $('#result').innerHTML = RESULT[s.result.game](s.result.summary, s.round);
  }
}

const RESULT = {
  greed: (r) => `
    <p class="result">합계 <b>${r.total.toLocaleString()}</b> / 한도 ${r.pot.toLocaleString()} →
    ${r.success ? '<b class="good">성공! 전원이 고른 만큼 받았습니다</b>' : '<b class="bad">초과! 전원 0점</b>'}</p>
    ${hist(r.hist, (i) => `${i * 10}~`)}`,
  trust: (r) => {
    const n = r.split + r.steal || 1;
    return `<p class="result">나누기 <b class="good">${Math.round((100 * r.split) / n)}%</b> · 독식 <b class="bad">${Math.round((100 * r.steal) / n)}%</b></p>
      <div class="bar"><i style="width:${(100 * r.split) / n}%"></i></div>`;
  },
  lowest: (r) => `
    <p class="result">${r.win ? `우승 숫자 <b class="good">${r.win}</b> — ${esc(r.winner)}` : '<b class="bad">겹치지 않은 숫자가 없습니다</b>'}</p>
    <div class="chips">${r.top.map(([v, c]) => `<span class="chip">${v}: ${c}명</span>`).join('')}</div>`,
  jamo: (r, round) => `
    <p class="result">통과 <b class="good">${r.ok}</b> · 탈락(${round.jamo} 사용 등) <b class="bad">${r.out}</b></p>
    <div class="chips">${r.popular.map(([w, c]) => `<span class="chip">${esc(w)} ×${c}</span>`).join('')}</div>`,
};

function hist(values, label) {
  const max = Math.max(1, ...values);
  return `<div class="hist" style="margin-bottom:24px">${values
    .map((v, i) => `<div style="height:${(100 * v) / max}%" title="${v}"><span>${label(i)}</span></div>`)
    .join('')}</div>`;
}
