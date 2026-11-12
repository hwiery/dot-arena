// Shared client helpers: a WebSocket that reconnects, a countdown, small DOM helpers.
export const $ = (s) => document.querySelector(s);

export function connect(onMessage, onOpen) {
  let ws;
  let delay = 500;
  const open = () => {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => { delay = 500; onOpen?.(); };
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onclose = () => { setTimeout(open, delay); delay = Math.min(delay * 2, 8000); };
  };
  open();
  return { send: (msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg)) };
}

export function countdown(el, endsAt) {
  clearInterval(el._t);
  const tick = () => {
    const s = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    el.textContent = s;
    el.classList.toggle('low', s <= 5);
    if (!s) clearInterval(el._t);
  };
  tick();
  el._t = setInterval(tick, 200);
}

export function toast(text) {
  let el = $('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.append(el); }
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 2200);
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const RULES = {
  greed: (r) => `0~${r.max}점 중 가져갈 점수를 고르세요. 모두의 합이 <b>${r.pot}점</b> 이하면 전원이 고른 만큼 받고, 넘으면 <b>전원 0점</b>.`,
  trust: () => '무작위 짝과 동시에 고릅니다. 둘 다 <b>나누기</b> → 각 50점, 한 명만 <b>독식</b> → 독식한 쪽 100점, 둘 다 독식 → 0점.',
  lowest: (r) => `1~${r.max} 중 숫자 하나. <b>아무도 겹치지 않은 가장 작은 숫자</b>를 고른 한 명이 ${r.prize}점.`,
  jamo: (r) => `주제: <b>${esc(r.topic)}</b> — 받침·초성 어디에도 <b class="bad">${r.jamo}</b>이 없는 한글 답(2~20자). 나만 쓴 답 100점, 겹친 답 30점.`,
};

export const NOTE = {
  unique: '나만 쓴 답!', duplicate: '다른 사람과 겹침', forbidden: '금지 자음 사용', short: '너무 짧음',
  long: '너무 김', 'not-hangul': '한글만 가능', none: '답을 안 냄',
};
