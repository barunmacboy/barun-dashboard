// 디스코드에서 맡긴 일 — #작업판·#할-일 카드 답글·DM으로 시작된 일의 지금 상태와 진행(2026-10-22 사장님:
// "디스코드 현황판에서 시작된 것들의 현황과 진행상황이 나와야지"). 자리: '맡긴 일' 화면(#p-tasks) — 한눈에는 같은 자료로 요약(barun:tasks 이벤트).
// 읽기: GET /api/tasks(dashboard/taskview.py) — 홈이 보일 때 10초마다. 일하는 중이면 최근 움직임·도는 보조 에이전트까지.
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const dur = (s) => s == null ? '' : s >= 86400 ? `${Math.floor(s / 86400)}일` : s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분` : s >= 60 ? `${Math.floor(s / 60)}분` : `${s}초`;
  const hm = (iso) => !iso ? '' : String(iso).slice(5, 16).replace('T', ' ').replace('-', '/');
  const ST = { run: ['일하는 중', 'run'], wait: ['승인·답 대기', 'warn'], queued: ['차례 대기', 'warn'], fail: ['실패', 'bad'], done: ['끝', 'ok'] };
  const noE = (t) => (window.noEmoji ? window.noEmoji(t) : String(t ?? ''));
  const ic = (name) => (window.ico ? window.ico(name) : '');
  let timer = 0, busy = false, showDone = false, loaded = false, sameState = '';
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');   // 2026-11-06: 디스코드 주소는 http(s)만
  // 2026-11-06: 스레드 이름이 '미국'·'이태리'뿐이면 무슨 일인지 몰라서 — 짧은 제목엔 요약 첫 줄을 붙임
  const headline = (t) => {
    const tt = noE(t.title).trim(), first = noE(t.summary || t.doing || '').split('\n').map((x) => x.trim()).find(Boolean) || '';
    if (!tt) return first.slice(0, 70) || '(제목 없음)';
    return tt.length < 8 && first ? `${tt} — ${first.length > 60 ? first.slice(0, 59) + '…' : first}` : tt;
  };

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
      <span class="desc">#작업판·카드 답글·DM</span></div><div id="tk-list"></div>`;
    page.append(sec);
    document.addEventListener('barun:page', (e) => { if (e.detail === 'home' || e.detail === 'tasks') load(); });
    load();
    timer = setInterval(() => { if (!document.hidden) load(); }, 10000);   // 그림·홈 둘 다 쓰므로 탭과 관계없이
    return true;
  }

  // 2026-10-22 15:33 사장님: "왜 무엇을 어떻게 몇분째 하고있는지만 나오면 됨" — 줄마다 그 네 가지만.
  const DOM = { orders: '주문·발송', mail: '메일·송장', pricing: '가격·위너', inquiry: '고객문의', close: '마감·분석', improve: '개선', infra: '인프라', sourcing: '소싱·원가' };
  function how(t) {
    if (t.state === 'run') {
      const subs = (t.subagents || []).map((s) => (s.staff ? noE(s.who) : `알바(${s.type || '도우미'})`) + (s.what ? ` · ${noE(s.what)}` : ''));
      return subs.length ? `지휘 → ${subs.join(' · ')}` : `지휘가 직접 ${t.stage === '실행' ? '처리' : '조사'}`;
    }
    return (t.domains || []).length ? `지휘 → ${t.domains.map((d) => DOM[d] || d).join(' · ')}` : '';
  }
  function what(t) {
    if (t.state === 'run') return noE(t.doing || (t.steps || []).slice(-1)[0]) || '막 시작함';
    if (t.state === 'wait') return t.summary ? `계획 승인 대기 · ${noE(t.summary)}` : '승인·답 대기';
    if (t.state === 'queued') return '앞선 일 끝나면 시작(동시 4개)';
    return noE(t.summary);
  }
  function row(t) {
    const r = E('div', 'tk-row');
    const top = E('div', 'tk-t');
    const [lab, cls] = ST[t.state] || [t.state, ''];
    if (t.state !== sameState) top.append(E('span', 'badge ' + cls, lab));   // 2026-11-06: 열린 일이 모두 같은 상태면 줄마다 같은 꼬리표를 반복하지 않음(머리의 숫자로)
    const url = safeUrl(t.url);
    if (url) { const a = E('a', null, headline(t)); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.title = '디스코드에서 열기'; top.append(a); }
    else top.append(E('span', null, headline(t)));
    const min = t.state === 'run' ? `${dur(t.secs)}째` : ['wait', 'queued'].includes(t.state) ? `${dur(t.secs)}째 대기` : hm(t.last);
    top.append(E('span', 'tk-min', min));
    r.append(top);
    const kv = E('dl', 'tk-kv');
    const add = (k, v) => { if (!v) return; kv.append(E('dt', null, k), E('dd', null, v)); };
    add('왜', `${t.by || '사장님'} 요청 · ${t.kind || '디스코드'}${t.stage ? ` · ${t.stage} 단계` : ''}`);
    add('무엇', what(t));
    add('어떻게', how(t));
    r.append(kv);
    // 관리 버튼(2026-10-22 사장님: "여기서 에이전트 관리가 되어야지 종료시키거나 지우거나")
    //   일하는 중: 멈춤(답글로 이어 감) · 끝내기(기다리던 답글·승인 버튼도 거둠)
    //   대기: 끝내기 · 끝·실패: 목록에서 지우기(디스코드 스레드·기록은 남음)
    const bar = E('div', 'tk-btns');
    const btn = (icon, label, cls, action, ask) => {
      // 2026-11-06: '끝내기'의 네모(stop) 그림이 체크박스처럼 보여서 — 그림 없이 글자 버튼으로
      const b = E('button', 'btn sm ' + cls); if (icon) b.innerHTML = ic(icon); b.append(document.createTextNode((icon ? ' ' : '') + label)); b.type = 'button';
      b.onclick = async () => {
        if (ask && !confirm(ask)) return;
        b.disabled = true;
        // 2026-11-06: 실패·응답 못 읽음도 조용히 넘어가 된 줄 알던 것 → 실패라고 알림
        try {
          const res = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, key: t.id }) });
          const j = await res.json().catch(() => ({ ok: false, msg: `응답을 읽지 못했어요(${res.status}) — 목록을 다시 보고 확인해 주세요` }));
          if (window.toast) window.toast((j.ok ? '' : '실패: ') + (j.msg || ''));
        } catch (e) { if (window.toast && e.message !== '로그인 필요') window.toast('실패: ' + e.message); } finally { b.disabled = false; load(); }
      };
      bar.append(b);
    };
    const tt = noE(t.title);
    if (t.state === 'run') btn('pause', '멈춤', 'ghost', 'task_stop', `'${tt}' 지금 하던 것만 멈출까요? 답글을 달면 이어 가요.`);
    if (['run', 'wait', 'queued'].includes(t.state)) btn('', '끝내기', '', 'task_close', `'${tt}' 일을 끝낼까요? 기다리던 답글·승인 버튼도 거둬요.`);
    if (['done', 'fail'].includes(t.state)) btn('trash', '목록에서 지우기', 'ghost', 'task_hide', null);
    else btn('trash', '끝내고 지우기', 'ghost', 'task_hide', `'${tt}' 일을 끝내고 목록에서 뺄까요? 스레드·기록은 남아요.`);
    if (url) { const a = E('a', 'btn sm ghost'); a.innerHTML = ic('external'); a.append(document.createTextNode(' 디스코드')); a.href = url; a.target = '_blank'; a.rel = 'noopener'; bar.append(a); }
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
      if (n) cnt.append(E('span', 'badge ' + ST[k][1], `${ST[k][0]} ${n}`));
    }
    const L = $('tk-list'); L.innerHTML = '';
    const open = d.tasks.filter((t) => t.state !== 'done');
    const done = d.tasks.filter((t) => t.state === 'done');
    const ss = new Set(open.map((t) => t.state)); sameState = open.length > 1 && ss.size === 1 ? [...ss][0] : '';
    if (!open.length) L.append(E('p', 'muted small', '진행·대기 중인 일 없음'));
    for (const t of open) L.append(row(t));
    if (done.length) {
      const shown = showDone ? done : done.slice(0, 3);
      for (const t of shown) L.append(row(t));
      if (done.length > 3) {
        const b = E('button', 'btn tk-more', showDone ? '접기' : `끝난 일 ${done.length - 3}개 더 · 최근 ${d.hours}시간`);
        b.type = 'button'; b.onclick = () => { showDone = !showDone; render(d); };
        L.append(b);
      }
    }
  }

  async function load() {
    if (busy) return; busy = true;
    // 2026-11-06: 503이면 목록이 빈 채로 아무 말이 없어 '맡긴 일 없음'처럼 보이던 것 → 처음 못 읽으면 알림(읽은 적 있으면 그대로 둠)
    try {
      const r = await (window.barunFetch || fetch)('/api/tasks');
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      render(await r.json()); loaded = true;
    } catch (e) {
      const L = $('tk-list');
      if (!loaded && L && e.message !== '로그인 필요') { L.textContent = ''; L.append(E('p', 'muted small', `맡긴 일을 읽지 못했어요(${e.message}) — 잠시 뒤 다시 읽어요.`)); }
    } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
