// 💬 디스코드에서 맡긴 일 — #작업판·#할-일 카드 답글·DM으로 시작된 일의 지금 상태와 진행(2026-10-22 사장님:
// "디스코드 현황판에서 시작된 것들의 현황과 진행상황이 나와야지"). 자리: '맡긴 일' 화면(#p-tasks) — 한눈에는 같은 자료로 요약(barun:tasks 이벤트).
// 읽기: GET /api/tasks(dashboard/taskview.py) — 홈이 보일 때 10초마다. 일하는 중이면 최근 움직임·도는 보조 에이전트까지.
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const dur = (s) => s == null ? '' : s >= 86400 ? `${Math.floor(s / 86400)}일` : s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분` : s >= 60 ? `${Math.floor(s / 60)}분` : `${s}초`;
  const hm = (iso) => !iso ? '' : String(iso).slice(5, 16).replace('T', ' ').replace('-', '/');
  const ST = { run: ['● 일하는 중', 'run'], wait: ['✋ 승인·답 기다림', 'warn'], queued: ['⏳ 차례 기다림', 'warn'], fail: ['❌ 실패', 'bad'], done: ['✅ 끝', 'ok'] };
  let timer = 0, busy = false, showDone = false;

  function install() {
    const page = $('p-tasks'); if ($('tk-sec') || !page) return !!$('tk-sec');
    const css = E('style'); css.textContent = `
      .tk-row { padding: 12px 2px; border-top: 1px solid var(--line); }
      .tk-row:first-child { border-top: 0; }
      .tk-t { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-weight: 600; }
      .tk-t a { color: var(--ink); } .tk-t a:hover { color: var(--blue-ink); }
      .tk-m { font-size: 12px; color: var(--muted); margin-top: 2px; }
      .tk-s { font-size: 14px; color: var(--sub); margin-top: 4px; overflow-wrap: anywhere; }
      .tk-steps { margin: 8px 0 0; padding: 8px 12px; background: var(--fill2); border-radius: var(--r-sm); font-size: 13px; color: var(--sub); }
      .tk-steps div + div { margin-top: 3px; } .tk-steps .now { color: var(--blue-ink); font-weight: 600; }
      .tk-more { margin-top: 8px; }
      .tk-btns { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
      .tk-min { margin-left: auto; font-size: 13px; font-weight: 600; color: var(--blue-ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .tk-kv { display: grid; grid-template-columns: 44px 1fr; gap: 3px 8px; margin: 6px 0 0; font-size: 14px; }
      .tk-kv dt { color: var(--muted); } .tk-kv dd { margin: 0; color: var(--sub); overflow-wrap: anywhere; }
      .tk-stop { margin-top: 6px; }`;
    document.head.append(css);
    const sec = E('div', 'card'); sec.id = 'tk-sec';
    sec.innerHTML = `<div class="card-h"><h2>디스코드에서 맡긴 일</h2><span class="act" id="tk-count"></span>
      <span class="desc">#작업판·카드 답글·DM으로 시작된 일이에요. 줄을 누르면 디스코드 스레드가 열려요.</span></div><div id="tk-list"></div>`;
    page.append(sec);
    document.addEventListener('barun:page', (e) => { if (e.detail === 'home' || e.detail === 'tasks') load(); });
    load();
    timer = setInterval(() => { if (!document.hidden) load(); }, 10000);   // 그림·홈 둘 다 쓰므로 탭과 관계없이
    return true;
  }

  // 2026-10-22 15:33 사장님: "왜 무엇을 어떻게 몇분째 하고있는지만 나오면 됨" — 줄마다 그 네 가지만.
  const DOM = { orders: '📦 주문·발송', mail: '✉️ 메일·송장', pricing: '💰 가격·위너', inquiry: '💬 고객문의', close: '📊 마감·분석', improve: '🛠 개선', infra: '⚙️ 인프라', sourcing: '🔎 소싱·원가' };
  function how(t) {
    if (t.state === 'run') {
      const subs = (t.subagents || []).map((s) => (s.staff ? s.who : `🧢 알바(${s.type || '도우미'})`) + (s.what ? ` — ${s.what}` : ''));
      return subs.length ? `🧭 지휘 → ${subs.join(' · ')}` : `🧭 지휘 에이전트가 직접${t.stage === '실행' ? ' 처리' : ' 조사'}`;
    }
    return (t.domains || []).length ? `🧭 지휘 → ${t.domains.map((d) => DOM[d] || d).join(' · ')}` : '';
  }
  function what(t) {
    if (t.state === 'run') return t.doing || (t.steps || []).slice(-1)[0] || '막 시작했어요';
    if (t.state === 'wait') return t.summary ? `계획을 올리고 승인·답을 기다려요 — ${t.summary}` : '승인·답을 기다려요';
    if (t.state === 'queued') return '앞선 일이 끝나면 바로 시작해요(동시에 4개까지)';
    return t.summary || '';
  }
  function row(t) {
    const r = E('div', 'tk-row');
    const top = E('div', 'tk-t');
    const [lab, cls] = ST[t.state] || [t.state, ''];
    top.append(E('span', 'badge ' + cls, lab));
    if (t.url) { const a = E('a', null, t.title || '(제목 없음)'); a.href = t.url; a.target = '_blank'; a.rel = 'noopener'; a.title = '디스코드 스레드 열기'; top.append(a); }
    else top.append(E('span', null, t.title || '(제목 없음)'));
    const min = t.state === 'run' ? `${dur(t.secs)}째` : t.state === 'wait' ? `${dur(t.secs)}째 기다림` : t.state === 'queued' ? `${dur(t.secs)}째 대기` : hm(t.last);
    top.append(E('span', 'tk-min', min));
    r.append(top);
    const kv = E('dl', 'tk-kv');
    const add = (k, v) => { if (!v) return; kv.append(E('dt', null, k), E('dd', null, v)); };
    add('왜', `${t.by || '사장님'} 요청 · ${t.kind || '디스코드'}${t.stage ? ` · ${t.stage} 단계` : ''}`);
    add('무엇', what(t));
    add('어떻게', how(t));
    r.append(kv);
    // 관리 버튼(2026-10-22 사장님: "여기서 에이전트 관리가 되어야지 종료시키거나 지우거나")
    //   일하는 중: ■ 지금 하던 것만 멈춤(답글로 이어 갈 수 있음) · ⏹ 끝내기(멈추고 기다리던 답글·승인 버튼도 거둠)
    //   승인·답 기다림·차례 기다림: ⏹ 끝내기 · 끝·실패: 🗑 목록에서 지우기(디스코드 스레드·기록은 남음)
    const bar = E('div', 'tk-btns');
    const btn = (label, cls, action, ask) => {
      const b = E('button', 'btn sm ' + cls, label); b.type = 'button';
      b.onclick = async () => {
        if (ask && !confirm(ask)) return;
        b.disabled = true;
        try {
          const res = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, key: t.id }) });
          const j = await res.json(); if (window.toast) window.toast((j.ok ? '' : '⚠ ') + j.msg);
        } catch (e) { /* 토큰 창 */ } finally { load(); }
      };
      bar.append(b);
    };
    if (t.state === 'run') btn('■ 지금 하던 것 멈춤', 'ghost', 'task_stop', `'${t.title}' — 지금 하던 것만 멈출까요? (스레드에 답글을 달면 이어 가요)`);
    if (['run', 'wait', 'queued'].includes(t.state)) btn('⏹ 끝내기', 'ghost', 'task_close', `'${t.title}' 일을 끝낼까요? 하던 것을 멈추고 기다리던 답글·승인 버튼도 거둬요.`);
    if (['done', 'fail'].includes(t.state)) btn('🗑 목록에서 지우기', 'ghost', 'task_hide', null);
    else btn('🗑 끝내고 지우기', 'ghost', 'task_hide', `'${t.title}' 일을 끝내고 이 목록에서도 뺄까요? (디스코드 스레드·기록은 남아요)`);
    if (t.url) { const a = E('a', 'btn sm ghost', '↗ 디스코드'); a.href = t.url; a.target = '_blank'; a.rel = 'noopener'; bar.append(a); }
    r.append(bar);
    return r;
  }

  function render(d) {
    window.barunTasksData = d;                               // 사무실 그림(office.js)이 같은 자료로 말풍선·알바 자리를 그림
    if (window.barunOfficeAgents) window.barunOfficeAgents();
    document.dispatchEvent(new CustomEvent('barun:tasks', { detail: d }));   // 한눈에 '맡긴 일' 요약(index.html)
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
