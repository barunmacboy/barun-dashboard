// 🤖 에이전트 한눈에 — 지금 도는 모든 에이전트와 다음 차례, 멈춤·재개·지금 중지 버튼 (2026-10-22 사장님: "어떤 에이전트가 어떤 일을 하고 다음 대기열은 무엇인지 한눈에 …
// 목록에다가도 돌고 있는 모든 에이전트를 나열하고 중지·재개 버튼 … 그 직원들 말고 추가 에이전트가 쓰이고 있다면 그것까지").
// 읽기: GET /api/agents(core/agents.py) 20초마다 → window.barunAgentsData + 사무실 그림 다시 그림(office.js barunOfficeAgents).
// 쓰기: POST /api/action agent_pause·agent_resume·agent_stop·task_stop·run — 누가 눌렀는지 #인프라에 남음(dashboard/api.py).
// 자리: '작업·자동화' 탭 맨 위 카드. 줄 순서 = 일하는 중 → 대기 → 멈춤 → 쉼(사람이 볼 것부터).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const dur = (s) => s == null ? '' : s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분` : s >= 60 ? `${Math.floor(s / 60)}분` : `${s}초`;
  const hm = (iso) => !iso ? '' : String(iso).slice(5, 16).replace('T', ' ').replace('-', '/');
  const ST = { running: ['● 일하는 중', 'run'], queued: ['대기', 'warn'], paused: ['⏸ 멈춤', ''], idle: ['쉬는 중', 'k-idle'] };
  const RANK = { running: 0, queued: 1, paused: 2, idle: 3 };
  let busy = false;

  function install() {
    if ($('ag-sec') || !$('p-work')) return false;
    const css = E('style'); css.textContent = `
      .ag-row { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 2px; border-top: 1px solid var(--line); }
      .ag-row:first-child { border-top: 0; }
      .ag-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--axis); }
      .ag-dot.running { background: var(--st-run); box-shadow: 0 0 0 3px var(--blue-bg); } .ag-dot.queued { background: var(--st-warn); } .ag-dot.paused { background: var(--muted); }
      .ag-t { font-weight: 600; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
      .ag-s { font-size: 13px; color: var(--sub); margin-top: 2px; overflow-wrap: anywhere; }
      .ag-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
      .ag-btns { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
      .ag-h { font-size: 12px; font-weight: 700; color: var(--muted); margin: 14px 0 2px; letter-spacing: .02em; }
      .ag-q li { display: flex; gap: 10px; padding: 6px 0; font-size: 14px; } .ag-q .n { color: var(--muted); min-width: 18px; font-variant-numeric: tabular-nums; }
      .ag-alert { padding: 10px 12px; border-radius: var(--r-sm); background: var(--orange-bg); color: var(--orange-ink); font-size: 14px; margin-bottom: 8px; }
      @media (max-width: 720px) { .ag-row { grid-template-columns: 10px minmax(0, 1fr); } .ag-btns { grid-column: 2; justify-content: flex-start; } }
      /* 사무실 그림 위 말풍선·대기 꼬리표·멈춤(office.js) */
      .room .st .bub { position: absolute; left: 50%; bottom: 100%; transform: translate(-50%, -2px); white-space: nowrap; font-size: 10px; line-height: 1;
        padding: 3px 5px; border-radius: 6px; background: var(--blue); color: #fff; pointer-events: none; }
      .room .st.k-paused .bub { background: var(--muted); }
      .room .st .qtag { position: absolute; right: -6px; bottom: -2px; font-size: 9px; line-height: 1; padding: 2px 4px; border-radius: 5px;
        background: var(--orange-bg); color: var(--orange-ink); border: 1px solid var(--orange); pointer-events: none; white-space: nowrap; }
      .room .st.k-paused { filter: grayscale(1); opacity: .75; }
      .badge.k-paused, .avatar.k-paused { background: var(--fill); color: var(--muted); }`;
    document.head.append(css);
    const sec = E('div', 'card'); sec.id = 'ag-sec';
    sec.innerHTML = `<div class="card-h"><h2>🤖 에이전트</h2><span class="act" id="ag-count"></span>
      <span class="desc">지금 도는 모든 에이전트와 다음 차례예요. ⏸ 멈춤 = 새 회차를 안 열어요(대기는 보관) · ■ 지금 중지 = 도는 회차를 바로 끝내요.</span></div>
      <div id="ag-alert"></div><div id="ag-list"></div>`;
    $('p-work').prepend(sec);
    load();
    setInterval(() => { if (!document.hidden) load(); }, 20000);
    return true;
  }

  async function post(body, btn, ask) {
    if (ask && !confirm(ask)) return;
    if (btn) btn.disabled = true;
    try {
      const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json(); if (window.toast) window.toast((j.ok ? '' : '⚠ ') + j.msg);
    } catch (e) { /* 토큰 창 */ } finally { if (btn) btn.disabled = false; load(); }
  }
  const B = (label, cls, title, fn) => { const b = E('button', 'btn sm ' + (cls || ''), label); b.type = 'button'; if (title) b.title = title; b.onclick = () => fn(b); return b; };

  function row(dot, title, badges, sub, sub2, btns) {
    const r = E('div', 'ag-row'); r.append(E('span', 'ag-dot ' + dot));
    const body = E('div'); const t = E('div', 'ag-t'); t.append(document.createTextNode(title));
    for (const [txt, cls] of badges) if (txt) t.append(E('span', 'badge ' + (cls || ''), txt));
    body.append(t); if (sub) body.append(E('div', 'ag-s', sub)); if (sub2) body.append(E('div', 'ag-sub', sub2));
    const bt = E('div', 'ag-btns'); for (const b of btns) bt.append(b);
    r.append(body, bt); return r;
  }

  function render(d) {
    window.barunAgentsData = d;
    if (window.barunOfficeAgents) window.barunOfficeAgents();
    const c = d.counts;
    const cnt = $('ag-count'); cnt.innerHTML = '';
    cnt.append(E('span', 'badge run', `일하는 중 ${c.working}`), E('span', 'badge', `보조 🤖 ${c.subagents}`), E('span', 'badge warn', `대기 ${c.queued}`));
    if (c.paused) cnt.append(E('span', 'badge', `멈춤 ${c.paused}`));
    const al = $('ag-alert'); al.innerHTML = '';
    if (!d.barund_alive) al.append(E('div', 'ag-alert', '회차 대기열(barund)이 2분 넘게 소식이 없어요 — 새 회차가 안 열릴 수 있어요.'));
    if (d.hold) al.append(E('div', 'ag-alert', `Claude 사용량 한도 — ${hm(d.hold.until)}까지 에이전트 회차를 열지 않아요.`));
    const L = $('ag-list'); L.innerHTML = '';

    L.append(E('div', 'ag-h', `직원 ${d.staff.length}명`));
    const staff = [...d.staff].sort((a, b) => RANK[a.state] - RANK[b.state]);
    for (const s of staff) {
      const [lab, cls] = ST[s.state];
      const subs = (s.subagents || []).map((a) => `${a.who}${a.what ? ' — ' + a.what : ''}`).join(' · ');
      const now = s.state === 'running' ? `${dur(s.secs)}째 · ${s.doing || '시작하는 중'}` : s.waiting.length ? `대기: ${s.waiting[0].why}` : (s.last ? `마지막 ${hm(s.last.at)} ${{ done: '✅', failed: '❌', skipped: '➖', cancelled: '■' }[s.last.state] || ''} ${s.last.note || ''}` : '');
      const why = (s.reasons || []).slice(-1)[0];
      const nxt = [s.waiting.length ? `다음 차례 ${s.waiting.length}개` : '', s.next ? `정기 ${hm(s.next)}` : '', subs ? `보조 ${subs}` : '', why && s.state === 'running' ? `이유 ${why}` : ''].filter(Boolean).join(' · ');
      const btns = [];
      if (s.state === 'running') btns.push(B('■ 지금 중지', 'ghost', '도는 회차를 바로 끝내요', (b) => post({ action: 'agent_stop', job: s.job }, b, `${s.name} 회차를 지금 끝낼까요? 하던 일이 중간에 멈춰요.`)));
      if (s.paused) btns.push(B('▶ 재개', 'primary', `${s.paused.by} ${hm(s.paused.at)} 멈춤`, (b) => post({ action: 'agent_resume', job: s.job }, b)));
      else btns.push(B('⏸ 멈춤', 'ghost', '새 회차를 열지 않아요(도는 회차는 끝까지)', (b) => post({ action: 'agent_pause', job: s.job }, b)));
      if (s.state !== 'running' && !s.paused) btns.push(B('▶ 지금 실행', '', '대기열에 넣어요', (b) => post({ action: 'run', job: s.job }, b)));
      L.append(row(s.paused && s.state !== 'running' ? 'paused' : s.state, s.name, [[s.paused && s.state !== 'running' ? '⏸ 멈춤' : lab, cls], [s.browser === 'aside' ? '브라우저' : '', '']],
        now, nxt, btns));
    }

    if (d.tasks.length) {
      L.append(E('div', 'ag-h', `작업판 일꾼 ${d.tasks.length}`));
      for (const t of d.tasks) {
        const subs = (t.subagents || []).map((a) => `${a.who}${a.what ? ' — ' + a.what : ''}`).join(' · ');
        const btns = [];
        if (t.url) { const a = E('a', 'btn sm ghost', '스레드 ↗'); a.href = t.url; a.target = '_blank'; a.rel = 'noopener'; btns.push(a); }
        if (t.state === 'running') btns.push(B('■ 중지', 'ghost', '이 작업의 일꾼을 멈춰요', (b) => post({ action: 'task_stop', key: t.id }, b, `'${t.title}' 작업을 멈출까요?`)));
        L.append(row(t.state, `💬 ${t.title}`, [[t.state === 'running' ? `● ${t.stage}` : '대기', t.state === 'running' ? 'run' : 'warn'], [t.by, '']],
          t.state === 'running' ? `${dur(t.secs)}째 · ${t.doing || '생각하는 중'}` : t.why, subs ? `보조 ${subs}` : '', btns));
      }
    }
    if (d.scripts.length) {
      L.append(E('div', 'ag-h', `스크립트(AI 없이) ${d.scripts.length}`));
      for (const s of d.scripts) L.append(row('running', s.name, [['● 도는 중', 'run']], '', '', []));
    }
    // 사람이 직접 연 세션(기록 없음)은 보이지 않는다 — 2026-10-22 사장님. 디스코드에서 맡긴 일은 홈 '💬 디스코드에서 맡긴 일'.
    L.append(E('div', 'ag-h', `다음 차례(대기열) ${d.queue.length}`));
    const ol = E('ol', 'ag-q list');
    if (!d.queue.length) ol.append(E('li', 'muted small', '기다리는 회차가 없어요 — 정기 시각·새 일이 생기면 바로 들어와요'));
    d.queue.forEach((q, i) => {
      const li = E('li'); li.append(E('span', 'n', String(i + 1)));
      const b = E('div'); b.append(E('div', null, `${q.name} — ${q.why}`), E('div', 'ag-sub', `${dur(q.wait_secs)}째 기다림 · ${(q.reasons || []).slice(-1)[0] || ''}`));
      li.append(b); ol.append(li);
    });
    L.append(ol);
  }

  async function load() {
    if (busy) return; busy = true;
    try { const r = await (window.barunFetch || fetch)('/api/agents'); if (r.ok) render(await r.json()); }
    catch (e) { /* 토큰 창은 barunFetch가 띄움 */ } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
