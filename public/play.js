import { $, connect, countdown, esc, toast, RULES, NOTE } from './common.js';

const KEY = 'dot-player';
const params = new URLSearchParams(location.search);
let saved = null;
try { saved = JSON.parse(localStorage.getItem(KEY)); } catch {}
if (saved && params.get('code') && saved.code !== params.get('code')) saved = null;

let lastRound = 0;

const conn = connect((msg) => {
  if (msg.t === 'joined') {
    saved = { code: msg.code, id: msg.id, token: msg.token };
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {}
    $('#joinForm').classList.add('hide');
    $('#game').classList.remove('hide');
    $('#me').textContent = msg.name;
  } else if (msg.t === 'state') {
    render(msg.state, msg.me);
  } else if (msg.t === 'ack') {
    if (msg.result !== 'ok') toast({ closed: '마감됐어요', invalid: '형식이 맞지 않아요', already: '이미 냈어요' }[msg.result] ?? msg.result);
  } else if (msg.t === 'error') {
    if (msg.code === 'no-room') { saved = null; try { localStorage.removeItem(KEY); } catch {} showJoin(); toast('방을 찾을 수 없어요'); }
    else toast({ full: '방이 가득 찼어요', name: '닉네임을 확인해 주세요' }[msg.code] ?? msg.code);
  } else if (msg.t === 'restarting') {
    toast('서버 업데이트 중 — 다시 연결합니다');
  }
}, () => {
  if (saved) conn.send({ t: 'rejoin', ...saved });
  else if (params.get('code') && params.get('name')) conn.send({ t: 'join', code: params.get('code'), name: params.get('name') });
  else showJoin();
});

function showJoin() {
  $('#joinForm').classList.remove('hide');
  $('#game').classList.add('hide');
  if (params.get('code')) $('#code').value = params.get('code');
}

$('#joinForm').onsubmit = (e) => {
  e.preventDefault();
  conn.send({ t: 'join', code: $('#code').value.trim(), name: $('#name').value });
};

function render(s, me) {
  if (!me) return;
  $('#score').textContent = me.score.toLocaleString();
  $('#rank').textContent = `${me.rank}/${s.players}`;
  if (!s.round) return;
  $('#title').textContent = s.round.title;
  $('#rule').innerHTML = RULES[s.round.game](s.round);
  const asking = s.phase === 'question';
  $('#timer').classList.toggle('hide', !asking);

  if (asking) {
    countdown($('#timer'), s.round.endsAt);
    $('#result').innerHTML = '';
    if (me.answered) $('#input').innerHTML = '<p class="good result">제출 완료! 결과를 기다리는 중…</p>';
    else if (s.roundNo !== lastRound) INPUT[s.round.game](s.round, me);
    lastRound = s.roundNo;
  } else if (me.last) {
    $('#input').innerHTML = '';
    const { delta, answer, note } = me.last;
    $('#result').innerHTML = `
      <p>내 답: <b>${answer === null ? '-' : esc(answer === 'split' ? '나누기' : answer === 'steal' ? '독식' : answer)}</b>${note ? ` · ${NOTE[note] ?? ''}` : ''}</p>
      <p class="${delta ? 'good' : 'bad'}" style="font-size:32px;margin:0">+${delta}점</p>
      ${summary(s.result)}`;
  }
}

function submit(value) {
  conn.send({ t: 'answer', value });
  $('#input').innerHTML = '<p class="good result">제출 완료! 결과를 기다리는 중…</p>';
}

const INPUT = {
  greed(r) { numberInput(0, r.max, '가져갈 점수'); },
  lowest(r) { numberInput(1, r.max, '숫자'); },
  trust(r, me) {
    $('#input').innerHTML = `
      <p>내 짝: <b>${me.partner ? esc(me.partner) : '하우스(항상 나눔)'}</b></p>
      <div class="choices"><button id="split">나누기</button><button id="steal" class="lava">독식</button></div>`;
    $('#split').onclick = () => submit('split');
    $('#steal').onclick = () => submit('steal');
  },
  jamo(r) {
    $('#input').innerHTML = `
      <div class="row"><div class="jamo">${r.jamo}</div><div class="muted">이 자음 금지!</div></div>
      <form id="f"><label for="v">${esc(r.topic)}</label><input id="v" maxlength="20" autocomplete="off" required>
      <p><button style="width:100%">제출</button></p></form>`;
    $('#v').focus();
    $('#f').onsubmit = (e) => { e.preventDefault(); submit($('#v').value); };
  },
};

function numberInput(min, max, label) {
  $('#input').innerHTML = `
    <form id="f"><label for="v">${label} (${min}~${max})</label>
    <input id="v" type="number" inputmode="numeric" min="${min}" max="${max}" required>
    <p><button style="width:100%">제출</button></p></form>`;
  $('#v').focus();
  $('#f').onsubmit = (e) => { e.preventDefault(); submit(Number($('#v').value)); };
}

function summary(res) {
  const r = res?.summary;
  if (!r) return '';
  switch (res.game) {
    case 'greed': return `<p class="muted">합계 ${r.total} / 한도 ${r.pot} → ${r.success ? '성공' : '초과'}</p>`;
    case 'trust': return `<p class="muted">전체 나누기 ${r.split}명 · 독식 ${r.steal}명</p>`;
    case 'lowest': return `<p class="muted">${r.win ? `우승 숫자 ${r.win} (${esc(r.winner)})` : '우승자 없음'}</p>`;
    case 'jamo': return `<p class="muted">통과 ${r.ok}명 · 탈락 ${r.out}명</p>`;
  }
  return '';
}
