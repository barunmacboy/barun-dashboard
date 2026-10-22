// 💬 디스코드에서 맡긴 일 — #작업판·#할-일 카드 답글·DM으로 시작된 일의 지금 상태와 진행(2026-10-22 사장님:
// "디스코드 현황판에서 시작된 것들의 현황과 진행상황이 나와야지"). 자리: 홈 맨 위 카드 바로 아래.
// 읽기: GET /api/tasks(dashboard/taskview.py) — 홈이 보일 때 10초마다. 일하는 중이면 최근 움직임·도는 보조 에이전트까지.
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const dur = (s) => s == null ? '' : s >= 86400 ? `${Math.floor(s / 86400)}일` : s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분` : s >= 60 ? `${Math.floor(s / 60)}분` : `${s}초`;
  const hm = (iso) => !iso ? '' : String(iso).slice(5, 16).replace('T', ' ').replace('-', '/');
  const ST = { run: ['● 일하는 중', 'run'], wait: ['✋ 승인·답 기다림', 'warn'], queued: ['⏳ 차례 기다림', 'warn'], fail: ['❌ 실패', 'bad'], done: ['✅ 끝', 'ok'] };
  let timer = 0, busy = false, showDone = false;

  function install() {
    if ($('tk-sec') || !$('p-home')) return false;
    const css = E('style'); css.textContent = `
      .tk-row { padding: 12px 2px; border-top: 1px solid var(--line); }
      .tk-row:first-child { border-top: 0; }
      .tk-t { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-weight: 600; }
      .tk-t a { color: var(--ink); } .tk-t a:hover { color: var(--blue-ink); }
      .tk-m { font-size: 12px; color: var(--muted); margin-top: 2px; }
      .tk-s { font-size: 14px; color: var(--sub); margin-top: 4px; overflow-wrap: anywhere; }
      .tk-steps { margin: 8px 0 0; padding: 8px 12px; background: var(--fill2); border-radius: var(--r-sm); font-size: 13px; color: var(--sub); }
      .tk-steps div + div { margin-top: 3px; } .tk-steps .now { color: var(--blue-ink); font-weight: 600; }
      .tk-more { margin-top: 8px; }`;
    document.head.append(css);
    const sec = E('div', 'card'); sec.id = 'tk-sec';
    sec.innerHTML = `<div class="card-h"><h2>💬 디스코드에서 맡긴 일</h2><span class="act" id="tk-count"></span>
      <span class="desc">#작업판·카드 답글·DM으로 시작된 일이에요. 줄을 누르면 디스코드 스레드가 열려요.</span></div><div id="tk-list"></div>`;
    const hero = document.querySelector('#p-home .hero');
    if (hero && hero.nextSibling) hero.parentNode.insertBefore(sec, hero.nextSibling); else $('p-home').prepend(sec);
    const orig = window.showTab;
    if (orig && !orig.__tk) {
      window.showTab = function (name, push) { orig(name, push); if (name === 'home') load(); };
      window.showTab.__tk = true;
    }
    load();
    timer = setInterval(() => { if (!document.hidden && !$('p-home').hidden) load(); }, 10000);
    return true;
  }

  function row(t) {
    const r = E('div', 'tk-row');
    const top = E('div', 'tk-t');
    const [lab, cls] = ST[t.state] || [t.state, ''];
    top.append(E('span', 'badge ' + cls, lab));
    if (t.url) { const a = E('a', null, t.title || '(제목 없음)'); a.href = t.url; a.target = '_blank'; a.rel = 'noopener'; top.append(a); }
    else top.append(E('span', null, t.title || '(제목 없음)'));
    r.append(top);
    const meta = [t.by, t.kind, t.stage ? `${t.stage} 단계` : '', t.domains && t.domains.length ? t.domains.join('·') : '',
      t.state === 'run' ? `${dur(t.secs)}째` : t.state === 'wait' ? `${dur(t.secs)}째 기다림` : t.state === 'queued' ? `${dur(t.secs)}째 대기` : hm(t.last),
      t.turns > 1 ? `주고받기 ${t.turns}번` : ''].filter(Boolean);
    r.append(E('div', 'tk-m', meta.join(' · ')));
    if (t.state === 'run') {
      const box = E('div', 'tk-steps');
      for (const s of t.steps || []) box.append(E('div', null, s));
      if (t.doing) box.append(E('div', 'now', '지금: ' + t.doing));
      for (const s of t.subagents || []) box.append(E('div', null, `↳ ${s.who}${s.what ? ' — ' + s.what : ''} 일하는 중`));
      if (!box.childNodes.length) box.append(E('div', null, '막 시작했어요'));
      r.append(box);
    } else if (t.summary) {
      r.append(E('div', 'tk-s', (t.state === 'wait' ? '마지막 답: ' : '') + t.summary));
    }
    return r;
  }

  function render(d) {
    const c = d.counts || {};
    const cnt = $('tk-count'); cnt.innerHTML = '';
    for (const [k, n] of [['run', c.run], ['wait', c.wait], ['queued', c.queued], ['done', c.done]]) {
      if (n) cnt.append(E('span', 'badge ' + ST[k][1], `${ST[k][0].replace(/^\S+\s/, '')} ${n}`));
    }
    const L = $('tk-list'); L.innerHTML = '';
    const open = d.tasks.filter((t) => t.state !== 'done');
    const done = d.tasks.filter((t) => t.state === 'done');
    if (!open.length) L.append(E('p', 'muted small', '지금 진행 중이거나 기다리는 일은 없어요.'));
    for (const t of open) L.append(row(t));
    if (done.length) {
      const shown = showDone ? done : done.slice(0, 3);
      for (const t of shown) L.append(row(t));
      if (done.length > 3) {
        const b = E('button', 'btn tk-more', showDone ? '접기' : `끝난 일 ${done.length - 3}개 더 보기(최근 ${d.hours}시간)`);
        b.type = 'button'; b.onclick = () => { showDone = !showDone; render(d); };
        L.append(b);
      }
    }
  }

  async function load() {
    if (busy) return; busy = true;
    try { const r = await (window.barunFetch || fetch)('/api/tasks'); if (r.ok) render(await r.json()); }
    catch (e) { /* 토큰 창은 barunFetch가 띄움 */ } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
