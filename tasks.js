// 디스코드에서 맡긴 일 — #작업판·#할-일 카드 답글·DM으로 시작된 일의 지금 상태와 진행(2026-10-22 사장님:
// "디스코드 현황판에서 시작된 것들의 현황과 진행상황이 나와야지"). 자리: '맡긴 일' 화면(#p-tasks) — 한눈에는 같은 자료로 요약(barun:tasks 이벤트).
// 읽기: GET /api/tasks(dashboard/taskview.py) — 홈이 보일 때 10초마다. 일하는 중이면 최근 움직임·도는 보조 에이전트까지.
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const dur = (s) => s == null ? '' : s >= 86400 ? `${Math.floor(s / 86400)}일` : s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분` : s >= 60 ? `${Math.floor(s / 60)}분` : '방금';
  const hm = (iso) => !iso ? '' : String(iso).slice(5, 16).replace('T', ' ').replace('-', '/');
  const ST = { run: ['일하는 중', 'run'], wait: ['승인·답 대기', 'warn'], queued: ['차례 대기', 'warn'], fail: ['실패', 'bad'], done: ['끝남', 'ok'] };
  const noE = (t) => (window.noEmoji ? window.noEmoji(t) : String(t ?? ''));
  // 서버 글의 ' — '는 화면에서 '·'로(뜻은 그대로, 2026-11-12 리뉴얼)
  const tidy = (t) => noE(t).replace(/\s+[—–]\s+/g, ' · ').trim();
  const ic = (name) => (window.ico ? window.ico(name) : '');
  let timer = 0, busy = false, showDone = false, loaded = false, sameState = '';
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');   // 2026-11-06: 디스코드 주소는 http(s)만
  const firstLine = (t) => tidy(t.summary || t.doing || '').split('\n').map((x) => x.trim()).find(Boolean) || '';
  // 2026-11-06: 스레드 이름이 '미국'·'이태리'뿐이면 무슨 일인지 몰라서 — 짧은 제목엔 요약 첫 줄을 붙임
  const headline = (t) => {
    const tt = tidy(t.title), first = firstLine(t);
    if (!tt) return first || '제목 없음';
    return tt.length < 8 && first ? `${tt} · ${first}` : tt;
  };

  function install() {
    const page = $('p-tasks'); if ($('tk-sec') || !page) return !!$('tk-sec');
    const css = E('style'); css.textContent = `
      .tk-row { display: grid; gap: 4px; padding: 16px 0; border-top: 1px solid var(--line); min-width: 0; }
      .tk-row:first-child { border-top: 0; padding-top: 4px; }
      .tk-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; font-size: 12.5px; color: var(--muted); min-width: 0; }
      .tk-meta .tk-min { margin-left: auto; font-size: 13px; font-weight: 600; color: var(--sub); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .tk-meta .tk-min.run { color: var(--blue-ink); }
      .tk-t { margin: 0; font-size: 15px; font-weight: 600; line-height: 1.45; color: var(--ink); overflow-wrap: anywhere;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .tk-t a { color: inherit; } .tk-t a:hover { color: var(--blue-ink); text-decoration: none; }
      .tk-s { margin: 0; font-size: 14px; color: var(--sub); overflow-wrap: anywhere;
        display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      .tk-h { margin: 0; font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
      .tk-btns { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      .tk-btns .more-link { margin-left: 0; }
      .tk-btns .btn.danger { margin-left: auto; }
      .tk-more { margin-top: 12px; }
      @media (min-width: 1360px) { #tk-list > .tk-row:nth-child(2) { padding-top: 4px; } }
      @media (max-width: 560px) { .tk-row { padding: 12px 0; } .tk-t { font-size: 14.5px; } .tk-s { -webkit-line-clamp: 2; } .tk-btns { margin-top: 4px; } }`;
    document.head.append(css);
    const sec = E('div', 'card'); sec.id = 'tk-sec';
    sec.innerHTML = `<div class="card-h"><h2>디스코드에서 맡긴 일</h2><span class="act" id="tk-count"></span>
      <span class="desc">#작업판, 할 일 카드 답글, DM으로 맡긴 일이 어디까지 왔는지</span></div><div id="tk-list"></div>`;
    page.append(sec);
    document.addEventListener('barun:page', (e) => { if (e.detail === 'home' || e.detail === 'tasks') load(); });
    load();
    timer = setInterval(() => { if (!document.hidden) load(); }, 10000);   // 그림·홈 둘 다 쓰므로 탭과 관계없이
    return true;
  }

  // 2026-10-22 15:33 사장님: "왜 무엇을 어떻게 몇분째 하고있는지만 나오면 됨" — 요청한 사람·무엇·누가 맡았나·몇 분째.
  const DOM = { orders: '주문·발송', mail: '메일·송장', pricing: '가격·위너', inquiry: '고객문의', close: '마감·분석', improve: '개선', infra: '인프라', sourcing: '소싱·원가' };
  // 보조 에이전트 종류(영어 이름)는 화면에 내지 않는다
  const helper = (type) => ({ Explore: '찾기 도우미', Plan: '계획 도우미' })[type] || '도우미';
  function how(t) {
    if (t.state === 'run') {
      const subs = (t.subagents || []).map((s) => (s.staff ? noE(s.who) : helper(s.type)) + (s.what ? ` ${tidy(s.what)}` : ''));
      return subs.length ? `나눠 맡은 곳: ${subs.join(', ')}` : `지휘 에이전트가 직접 ${t.stage === '실행' ? '처리하는 중' : '조사하는 중'}`;
    }
    return (t.domains || []).length ? `맡은 곳: ${t.domains.map((d) => DOM[d] || d).join(', ')}` : '';
  }
  function what(t) {
    if (t.state === 'run') return tidy(t.doing || (t.steps || []).slice(-1)[0]) || '방금 시작했어요';
    if (t.state === 'queued') return '앞선 일이 끝나면 시작해요. 한 번에 4개까지 돌아요.';
    return tidy(t.summary);
  }
  function row(t) {
    const r = E('div', 'tk-row');
    const meta = E('div', 'tk-meta');
    const [lab, cls] = ST[t.state] || [t.state, ''];
    if (t.state !== sameState) meta.append(E('span', 'badge ' + cls, lab));   // 2026-11-06: 열린 일이 모두 같은 상태면 줄마다 같은 꼬리표를 반복하지 않음(머리의 숫자로)
    meta.append(E('span', null, [`요청 ${t.by || '사장님'}`, noE(t.kind || '디스코드'), t.stage ? `${t.stage} 단계` : ''].filter(Boolean).join(' · ')));
    const fresh = t.secs != null && t.secs < 60;   // 1분 안이면 '방금'
    const min = t.state === 'run' ? (fresh ? '방금 시작' : `${dur(t.secs)}째`) : ['wait', 'queued'].includes(t.state) ? (fresh ? '방금부터 대기' : `${dur(t.secs)}째 대기`) : hm(t.last);
    if (min) meta.append(E('span', 'tk-min' + (t.state === 'run' ? ' run' : ''), min));
    const url = safeUrl(t.url);
    const head = headline(t);
    const title = E('h3', 'tk-t');
    if (url) { const a = E('a', null, head); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.title = '디스코드에서 열기'; title.append(a); }
    else title.textContent = head;
    title.title = head;
    r.append(meta, title);
    // 제목에 이미 붙은 요약 첫 줄은 다시 쓰지 않는다
    let body = what(t);
    if (body && head.includes(firstLine(t)) && firstLine(t) && body.startsWith(firstLine(t))) body = body.slice(firstLine(t).length).replace(/^[\s·,.]+/, '');
    if (body && body !== head) r.append(E('p', 'tk-s', body));
    else if (t.state === 'wait' && !t.summary) r.append(E('p', 'tk-s', '승인이나 답을 기다려요.'));
    const hw = how(t); if (hw) r.append(E('p', 'tk-h', hw));
    // 관리 버튼(2026-10-22 사장님: "여기서 에이전트 관리가 되어야지 종료시키거나 지우거나")
    //   일하는 중: 멈추기(답글로 이어 감) · 끝내기(기다리던 답글·승인 버튼도 거둠)
    //   대기: 끝내기 · 끝·실패: 목록에서 지우기(디스코드 스레드·기록은 남음)
    const bar = E('div', 'tk-btns');
    const btn = (icon, label, cls, action, ask) => {
      // 2026-11-06: '끝내기'의 네모(stop) 그림이 체크박스처럼 보여서 — 그림 없이 글자 버튼으로
      const b = E('button', 'btn sm ' + cls); if (icon) b.innerHTML = ic(icon); b.append(document.createTextNode(label)); b.type = 'button';
      b.onclick = async () => {
        if (ask && !confirm(ask)) return;
        b.disabled = true;
        // 2026-11-06: 실패·응답 못 읽음도 조용히 넘어가 된 줄 알던 것 → 실패라고 알림
        try {
          const res = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, key: t.id }) });
          const j = await res.json().catch(() => ({ ok: false, msg: `응답을 읽지 못했어요(${res.status}). 목록에서 바뀌었는지 확인해 주세요.` }));
          if (window.toast) window.toast((j.ok ? '' : '실패: ') + (j.msg || (j.ok ? '처리했어요' : '서버가 이유를 주지 않았어요')));
        } catch (e) { if (window.toast && e.message !== '로그인 필요') window.toast('실패: ' + e.message); } finally { b.disabled = false; load(); }
      };
      bar.append(b);
    };
    const tt = head.length > 40 ? head.slice(0, 39) + '…' : head;
    if (['run', 'wait', 'queued'].includes(t.state)) btn('', '끝내기', 'weak', 'task_close', `'${tt}' 일을 끝낼까요? 기다리던 답글·승인 버튼도 거둬요.`);
    if (t.state === 'run') btn('pause', '멈추기', '', 'task_stop', `'${tt}' 지금 하던 것만 멈출까요? 답글을 달면 이어 가요.`);
    if (url) { const a = E('a', 'more-link', '디스코드에서 열기 ›'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; bar.append(a); }
    if (['done', 'fail'].includes(t.state)) btn('trash', '목록에서 지우기', 'ghost', 'task_hide', null);
    else btn('trash', '끝내고 지우기', 'danger', 'task_hide', `'${tt}' 일을 끝내고 목록에서 뺄까요? 스레드·기록은 남아요.`);
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
    if (!open.length) L.append(E('p', 'muted small', '지금 하거나 기다리는 일이 없어요. 맡기기 버튼이나 디스코드 #작업판으로 맡기면 여기에 보여요.'));
    for (const t of open) L.append(row(t));
    if (done.length) {
      const shown = showDone ? done : done.slice(0, 3);
      for (const t of shown) L.append(row(t));
      if (done.length > 3) {
        const b = E('button', 'btn sm ghost tk-more', showDone ? '접기' : `끝난 일 ${done.length - 3}개 더 보기 · 최근 ${d.hours}시간`);
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
      if (!loaded && L && e.message !== '로그인 필요') { L.textContent = ''; L.append(E('p', 'muted small', `맡긴 일을 읽지 못했어요(${e.message}). 잠시 뒤 다시 읽어요.`)); }
    } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
