// 새 기능 알림 한 곳(2026-11-13 사장님 "새로운 기능들에 대해 NEW 라고 뱃지나 화살표 등으로 알려주는 기능도 만들어줘. 누락된 곳 없는지 꼼꼼히 검증하고").
// 화면 기능을 새로 만들거나 크게 바꾸면 FEATURES에 한 줄 — {id, at: 만든 날, page: 화면 이름(index.html PAGES — ''면 화면 전체),
//   target: NEW를 붙일 글자 칸(CSS 선택자 — 없으면 그 화면 위 '새 기능' 줄), put: 'start'(칸 맨 앞에 — 옆으로 넘기는 줄 끝은 휴대폰에서 안 보임), title, desc(한 문장)}.
//  · 만든 날부터 14일만 보이고, 이 브라우저에서 확인하면 꺼짐(사람·기기마다 따로 — localStorage)
//  · 메뉴 NEW(그 화면에 아직 안 본 새 기능) · 가리킨 칸 옆 NEW 표 + 첫 하나는 화살표 말풍선 · 칸이 없거나 아직 안 그려졌으면 화면 위 '새 기능' 줄
//  · 한눈에 '새로 생긴 기능' 카드 — 누르면 그 화면으로 가서 그 칸을 반짝임
// 빠진 곳 검사: dashboard/tests/test_whatsnew.py(화면 이름·가리킨 칸이 코드에 있는지·날짜)
(() => {
  const DAYS = 14, KEY = 'barun.wn.seen';
  const FEATURES = [
    { id: 'pay-page', at: '2026-11-06', page: 'pay', target: '#py-title', title: '결제 화면',
      desc: 'AI가 결제할 카드와 적립 혜택, 구매처별 카드, AI가 쓴 금액을 한 화면에서 봐요.' },
    { id: 'sheet-row-color', at: '2026-11-09', page: 'data', title: '주문 시트 줄 색 칠하기',
      desc: '줄을 고르면 아래 막대에 색 단추가 생겨요. ⌥1~7로 칠하고 같은 키를 다시 누르면 풀려요. ⌥0은 모두 풀어요.' },
    { id: 'sheet-tab-hide', at: '2026-11-09', page: 'data', title: '탭마다 기본으로 숨긴 칸',
      desc: '일본 탭은 주문일시·국가, 기타유럽을 뺀 탭은 국가 칸을 기본으로 숨겨요. 열 보이기에서 켜면 다시 보여요.' },
    { id: 'invoice-check', at: '2026-11-09', page: 'todo', title: '송장 칸 실수 알림',
      desc: '같은 국내송장이 다른 받는 분 줄에 있거나 해외·국내 송장이 어긋나면 발송 전에 카드로 알리고 [고치기]를 보여 줘요.' },
    { id: 'jp-shop-list', at: '2026-11-10', page: 'data', title: '일본 탭 구매처 고르기',
      desc: '일본 탭 구매처 칸에서 포스트몰·재팬인사이트·amazon.co.jp 중 하나를 골라요.' },
    { id: 'renewal', at: '2026-11-12', page: '', title: '현황판 새 디자인',
      desc: '모든 화면의 글·버튼·움직임을 다듬었어요. 마우스를 올리면 카드에 옅은 빛이 따라가요.' },
    { id: 'settings-page', at: '2026-11-12', page: 'settings', target: '#st-title', title: '설정 화면',
      desc: '한도·기준 시간·자동 처리 스위치·예약 시각·AI 모델을 한곳에서 바꿔요. 칸마다 설명과 바꾸면 생기는 일이 있어요.' },
    { id: 'acct-add', at: '2026-11-12', page: 'settings', target: '#st-acct-card .card-h h2', title: '쿠팡 계정 추가',
      desc: '다른 쿠팡 계정 키를 여기서 넣으면 연결을 확인한 뒤 저장하고, 그 계정 주문도 바른청년처럼 처리해요.' },
    { id: 'loading', at: '2026-11-13', page: '', title: '불러오는 중 표시',
      desc: '자료를 받는 동안 맨 위 파란 막대, 도는 고리, 회색 뼈대가 보여요.' },
    { id: 'mobile-scroll', at: '2026-11-13', page: '', title: '휴대폰 화면 정리',
      desc: '카드 안 긴 목록은 접고 [더 보기]로 펼쳐요. 표와 업무 흐름 칸에서 손가락이 갇히지 않아요.' },
    { id: 'ship-delay', at: '2026-11-13', page: 'settings', target: '[data-key="ship.delay_days_jp"] .st-l b', title: '발송지연 안내일',
      desc: '네이버 발송지연 안내일을 오늘부터 영업일로 일본 3일·다른 나라 5일로 정해요. 한국 공휴일은 빼요.' },
    { id: 'register-acct', at: '2026-11-13', page: 'settings', target: '[data-key="account.coupang_register"] .st-l b', title: '쿠팡 등록 계정',
      desc: '새 쿠팡 상품과 수량 옵션을 어느 계정에 올릴지 골라요. 소싱 자동 등록도 이 값을 따라요.' },
    { id: 'acct-sourcing', at: '2026-11-13', page: 'sourcing', target: '#sc-acct .k', title: '쿠팡 등록 계정 표시',
      desc: '상품 발굴 맨 위에 지금 쿠팡 등록 계정과 [바꾸기]가 있어요.' },
    { id: 'acct-catalog', at: '2026-11-13', page: 'catalog', target: '#ct-kpis .acct-stat .k', title: '다른 쿠팡 계정 상품',
      desc: '헬스플래닛처럼 다른 계정에 올린 상품을 숫자 칸과 보라 이름표로 보여요. 누르면 그 계정 상품만 봐요.' },
    { id: 'acct-flow', at: '2026-11-13', page: 'flow', target: '#fl-plat', put: 'start', title: '판매 계정으로 거르기',
      desc: '쿠팡·바른청년, 쿠팡·헬스플래닛으로 거르고, 다른 계정 주문엔 보라 이름표가 붙어요.' },
    { id: 'acct-data', at: '2026-11-13', page: 'data', target: '.dt-tables [data-table="orders"]', title: '판매 계정 칸',
      desc: '쿠팡·네이버 주문 표에 판매 계정 칸과 거르기가 생겼어요. 주문 시트는 플랫폼 칸에 쿠팡·헬스플래닛처럼 보여요.' },
    { id: 'acct-paths', at: '2026-11-13', page: 'paths', title: '주문 경로 계정 이름표',
      desc: '다른 쿠팡 계정 주문은 줄에 보라 이름표가 붙어요.' },
    { id: 'acct-health', at: '2026-11-13', page: 'health', target: '#acct-sec .card-h h2', title: '판매 계정 상태',
      desc: '다른 쿠팡 계정 키로 상품을 읽었는지, 심사·반려와 30일 주문을 보여요.' },
    { id: 'acct-home', at: '2026-11-13', page: 'home', target: '#sys [data-goto="health:acct-sec"] .k', title: '판매 계정',
      desc: '시스템 카드에 판매 계정과 새 상품을 올리는 계정이 보여요.' },
    { id: 'whatsnew', at: '2026-11-13', page: 'home', target: '#wn-sec .card-h h2', title: '새 기능 알림',
      desc: '새로 생긴 기능에 NEW 표가 붙어요. 확인하면 꺼지고, 14일이 지나면 저절로 사라져요.' },
  ];
  const root = typeof window !== 'undefined' ? window : globalThis;
  root.BARUN_FEATURES = FEATURES;          // 시험(dashboard/tests/test_whatsnew.py)이 읽음
  if (typeof document === 'undefined') return;

  const E = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  let seen = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch (e) { /* 개인 창 등 — 이번 화면에서만 기억 */ } };
  const born = (f) => new Date(`${f.at}T00:00:00`).getTime();
  const fresh = (f) => Date.now() - born(f) < DAYS * 864e5;
  const live = (f) => fresh(f) && !seen[f.id];
  const keepNow = new Set();               // 이번 화면에서 확인한 것 — 화면을 옮길 때까지 NEW 표는 그대로(바로 사라지면 뭐가 새건지 못 봄)
  const shown = (f) => live(f) || keepNow.has(f.id);
  const cur = () => ((document.querySelector('main .page:not([hidden])') || {}).id || '').slice(2);
  const pageName = (p) => (document.querySelector(`.nav-i[data-tab="${p}"] .lab`) || {}).textContent || '';
  const missing = new Map();               // 가리킨 칸을 처음 못 찾은 때 — 4초 넘게 없으면 화면 위 줄로
  const timers = new Map();
  let tipFor = null, sigBar = '', sigHome = '';

  function see(ids, keep) {
    const t = Date.now();
    for (const id of ids) { seen[id] = t; if (keep) keepNow.add(id); else keepNow.delete(id); }
    save(); nav(); home(); if (!keep) marks();
  }

  // ── 메뉴 NEW ──
  function nav() {
    const by = {};
    for (const f of FEATURES) if (f.page && live(f)) (by[f.page] = by[f.page] || []).push(f.title);
    document.querySelectorAll('.nav-i[data-tab]').forEach((b) => {
      const ts = by[b.dataset.tab]; let n = b.querySelector('.nb.wn');
      if (!n && ts) { n = E('span', 'nb wn', 'NEW'); b.append(n); }
      if (n) { n.hidden = !ts || !!b.querySelector('.nb.new:not([hidden])'); n.title = ts ? `새 기능: ${ts.join(', ')}` : ''; }   // 새 자료 NEW가 이미 있으면 하나만
    });
    document.querySelectorAll('.tb-i[data-tab]').forEach((b) => {
      const cnt = b.querySelector('.nb:not([hidden])');          // 숫자 표가 있으면 점은 안 겹치게
      b.classList.toggle('has-new', !!by[b.dataset.tab] && !cnt);
    });
    const more = document.getElementById('tb-more');
    if (more) more.classList.toggle('has-new', !!document.querySelector('.nav-i .nb.new:not([hidden]), .nav-i .nb.wn:not([hidden])'));
  }

  // ── 가리킨 칸 옆 NEW · 화면 위 '새 기능' 줄 · 화살표 말풍선 ──
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => {
    for (const e of es) {                                         // 칸이 3초 넘게 보였으면 확인한 것으로(표는 화면을 옮길 때까지)
      const id = e.target.dataset.id;
      if (e.isIntersecting && !timers.has(id)) timers.set(id, setTimeout(() => { timers.delete(id); if (id !== tipFor && !seen[id]) see([id], true); }, 3000));   // 말풍선이 가리키는 것은 [알겠어요]로만
      else if (!e.isIntersecting) { clearTimeout(timers.get(id)); timers.delete(id); }
    }
  }, { threshold: 0.6 }) : null;

  function marks() {
    const p = cur();
    if (!p) return;
    const here = [];
    for (const f of FEATURES) {
      if (f.page !== p || !f.target) continue;
      const el = document.querySelector(f.target);
      if (!shown(f)) { document.querySelectorAll(`.wn-pill[data-id="${f.id}"]`).forEach((x) => x.remove()); continue; }
      if (!el || !el.getClientRects().length) { if (!missing.has(f.id)) missing.set(f.id, Date.now()); continue; }
      missing.delete(f.id);
      if (!el.querySelector(`:scope > .wn-pill[data-id="${f.id}"]`)) {
        const pill = E('span', 'wn-pill', 'NEW'); pill.dataset.id = f.id; pill.title = `${f.title} — ${f.desc}`;
        if (f.put === 'start') { pill.classList.add('start'); el.prepend(pill); } else el.append(pill);
        if (io) io.observe(pill);
      }
      here.push(f);
    }
    bar(p);
    const keep = tipFor && here.find((f) => f.id === tipFor && shown(f));
    const inView = (f) => { const r = (document.querySelector(`.wn-pill[data-id="${f.id}"]`) || { getBoundingClientRect: () => ({}) }).getBoundingClientRect(); return r.width && r.top >= 0 && r.bottom <= innerHeight; };
    tip(keep || here.filter(live).find(inView) || here.find(live) || null);   // 말풍선은 지금 보이는 새 기능부터(목록 차례로 고르면 화면 밖을 가리켜 안 보이던 것)
  }

  function bar(p) {
    const items = FEATURES.filter((f) => f.page === p && shown(f) && (!f.target || (missing.has(f.id) && Date.now() - missing.get(f.id) > 4000)));
    const sig = p + ':' + items.map((f) => f.id).join(',');
    let b = document.getElementById('wn-bar');
    if (sig === sigBar && b && b.isConnected) return;          // 같은 내용이면 다시 그리지 않음(감시가 제 그림에 다시 불리는 것을 막음)
    sigBar = sig;
    if (!items.length) { if (b) b.hidden = true; return; }
    if (!b) { b = E('section', 'card wn-bar'); b.id = 'wn-bar'; b.setAttribute('aria-label', '이 화면의 새 기능'); }
    const sec = document.getElementById('p-' + p);
    if (sec && b.parentElement !== sec) sec.prepend(b);          // 지금 화면 맨 위(화면을 옮기면 그 화면으로)
    b.hidden = false; b.textContent = '';
    const h = E('div', 'wn-bh'); h.append(E('span', 'wn-pill', 'NEW'), E('b', null, '이 화면의 새 기능'));
    const ok = E('button', 'btn sm', '확인했어요'); ok.type = 'button'; ok.onclick = () => { sigBar = ''; see(items.map((f) => f.id)); };
    h.append(ok);
    const ul = E('ul', 'wn-list');
    for (const f of items) { const li = E('li'); li.append(E('b', null, f.title), E('span', null, f.desc)); ul.append(li); }
    b.append(h, ul);
  }

  function tip(f) {
    let t = document.getElementById('wn-tip');
    if (!f) { if (t) t.hidden = true; tipFor = null; return; }
    if (!t) { t = E('div', 'wn-tip'); t.id = 'wn-tip'; t.setAttribute('role', 'status'); document.body.append(t); }
    if (tipFor !== f.id) {
      tipFor = f.id; t.textContent = '';
      const ok = E('button', 'btn sm primary', '알겠어요'); ok.type = 'button';
      ok.onclick = () => { const id = tipFor; tipFor = null; document.querySelectorAll(`.wn-pill[data-id="${id}"]`).forEach((x) => x.remove()); see([id]); };
      t.append(E('span', 'wn-arrow'), E('span', 'wn-k', '새로 생겼어요'), E('b', null, f.title), E('p', null, f.desc), ok);
    }
    place();
  }
  function place() {
    const t = document.getElementById('wn-tip');
    if (!t || !tipFor) return;
    const pill = document.querySelector(`.wn-pill[data-id="${tipFor}"]`);
    const r = pill && pill.getBoundingClientRect(), top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 60;
    const vis = r && r.width && r.bottom > top && r.top < innerHeight - 90 && !document.querySelector('dialog[open]');
    t.hidden = !vis;
    if (!vis) return;
    const w = Math.min(300, innerWidth - 24);
    t.style.width = `${w}px`;
    const left = Math.min(Math.max(12, r.left + r.width / 2 - 28), innerWidth - w - 12);
    const below = r.bottom + 12 + t.offsetHeight < innerHeight - 8;
    t.style.left = `${left}px`; t.style.top = `${below ? r.bottom + 10 : r.top - 10 - t.offsetHeight}px`;
    t.classList.toggle('up', !below); t.style.setProperty('--ax', `${Math.max(14, Math.min(w - 14, r.left + r.width / 2 - left))}px`);
  }

  // ── 한눈에 '새로 생긴 기능' ──
  function home() {
    const stack = (document.getElementById('mine-sec') || {}).parentElement;
    if (!stack) return;
    const all = FEATURES.filter(fresh).sort((a, b) => b.at.localeCompare(a.at)), on = all.filter(live);
    const sig = all.map((f) => f.id + (live(f) ? '+' : '-')).join(',');
    let c = document.getElementById('wn-sec');
    if (sig === sigHome && c && c.isConnected) return;
    sigHome = sig;
    if (!all.length) { if (c) c.hidden = true; return; }
    if (!c) { c = E('div', 'card'); c.id = 'wn-sec'; stack.prepend(c); }
    c.hidden = false; c.textContent = '';
    const h = E('div', 'card-h'), h2 = E('h2', null, '새로 생긴 기능');
    h.append(h2, E('span', 'desc', on.length ? `아직 안 본 것 ${on.length}개 · 최근 ${DAYS}일` : `최근 ${DAYS}일 ${all.length}개를 다 봤어요`));
    if (on.length) { const ok = E('button', 'more-link', '모두 확인'); ok.type = 'button'; ok.onclick = () => see(on.map((f) => f.id)); h.append(ok); }
    c.append(h);
    const row = (f) => {
      const li = E('li', live(f) ? 'on' : 'off'), b = E('button'); b.type = 'button';
      const t = E('span', 't'); t.append(E('b', null, f.title)); if (live(f)) t.append(E('span', 'wn-pill', 'NEW'));
      b.append(t, E('span', 'd', f.desc), E('span', 'm', `${f.at.slice(5).replace('-', '/')} · ${f.page ? pageName(f.page) || f.page : '모든 화면'}${f.page ? ' · 보러 가기 ›' : ''}`));
      b.onclick = () => go(f); li.append(b); return li;
    };
    const list = (fs) => { const ul = E('ul', 'wn-home'); fs.forEach((f) => ul.append(row(f))); return ul; };
    const fold = (label, fs) => { const d = E('details', 'wn-more'); d.append(E('summary', null, label), list(fs)); return d; };
    const rest = all.filter((f) => !live(f));
    if (on.length) { c.append(list(on)); if (rest.length) c.append(fold(`본 것 ${rest.length}개`, rest)); }
    else c.append(fold('다시 보기', all));                        // 다 봤으면 접어 둠
  }
  function go(f) {
    if (!f.page) { see([f.id]); return; }                        // 화면 전체 기능은 확인만
    if (window.showTab) window.showTab(f.page);
    let n = 0;
    const tick = () => {
      const el = f.target && document.querySelector(f.target);
      if (el && el.getClientRects().length) {
        const box = el.closest('.card, .stat, .st-row, .sc-acct, .ct-seg, .tab, li, section') || el;
        box.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        box.classList.add('wn-flash'); setTimeout(() => box.classList.remove('wn-flash'), 2400);
        if (live(f)) { tipFor = null; marks(); tip(f); }
      } else if (n++ < 30) setTimeout(tick, 200);
      else { const b = document.getElementById('wn-bar'); if (b && !b.hidden) b.scrollIntoView({ block: 'start' }); }
    };
    setTimeout(tick, 200);
  }

  // ── 모양 ──
  const css = E('style');
  css.textContent = `
    .nb.wn { font-size: 10px; letter-spacing: .05em; padding: 0 5px; line-height: 17px; }
    .wn-pill { display: inline-flex; align-items: center; flex: none; height: 16px; padding: 0 5px; margin-left: 6px; border-radius: 5px; background: var(--red); color: #fff;
      font-size: 10px; font-weight: 800; letter-spacing: .04em; line-height: 16px; vertical-align: 2px; font-style: normal; white-space: nowrap; }
    .wn-bh .wn-pill, .wn-home .wn-pill { margin-left: 0; } .wn-pill.start { margin: 0 6px 0 4px; align-self: center; }
    .wn-tip { position: fixed; z-index: 85; background: var(--ink); color: var(--card); border-radius: 12px; padding: 12px 14px; box-shadow: var(--pop); font-size: 13px; line-height: 1.5; }
    .wn-tip .wn-k { display: block; font-size: 12px; font-weight: 700; color: color-mix(in srgb, var(--card) 70%, transparent); }
    .wn-tip b { display: block; font-size: 14.5px; margin: 2px 0; } .wn-tip p { margin: 0 0 10px; color: color-mix(in srgb, var(--card) 86%, transparent); }
    .wn-tip .wn-arrow { position: absolute; top: -5px; left: var(--ax, 24px); width: 12px; height: 12px; background: var(--ink); transform: translateX(-50%) rotate(45deg); border-radius: 2px; }
    .wn-tip.up .wn-arrow { top: auto; bottom: -5px; }
    .wn-bar { border-color: color-mix(in srgb, var(--red) 35%, var(--line)); }
    .wn-bh { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .wn-bh b { font-size: 15px; } .wn-bh .btn { margin-left: auto; }
    .wn-list { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 8px; }
    .wn-list li { display: grid; gap: 2px; font-size: 13.5px; color: var(--sub); } .wn-list li b { color: var(--ink); font-size: 14px; }
    #wn-sec { order: 0; } .wn-home { list-style: none; margin: 4px 0 0; padding: 0; display: grid; }
    .wn-home li + li { border-top: 1px solid var(--line); }
    .wn-home button { all: unset; box-sizing: border-box; display: grid; gap: 2px; width: 100%; padding: 10px 4px; cursor: pointer; border-radius: 10px; }
    .wn-home button:hover { background: var(--hover); } .wn-home button:focus-visible { outline: 2px solid var(--blue); }
    .wn-home .t { display: flex; align-items: center; gap: 6px; font-size: 14.5px; } .wn-home .d { font-size: 13px; color: var(--sub); line-height: 1.45; }
    .wn-home .m { font-size: 12px; color: var(--muted); } .wn-home li.off .t b { font-weight: 600; color: var(--sub); }
    .wn-more > summary { font-size: 13px; color: var(--sub); padding: 8px 0 0; }
    @media (prefers-reduced-motion: no-preference) {
      .wn-pill { animation: wn-pulse 1.8s ease-in-out infinite; }
      .wn-tip:not([hidden]) { animation: wn-in .28s var(--ease-out, ease-out); }
      .wn-flash { animation: wn-flash 2.4s var(--ease-out, ease-out); }
    }
    @keyframes wn-pulse { 50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--red) 22%, transparent); } }
    @keyframes wn-in { from { opacity: 0; transform: translateY(4px); } }
    @keyframes wn-flash { 0%, 55% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--red) 55%, transparent); } 100% { box-shadow: 0 0 0 3px transparent; } }`;
  document.head.append(css);

  // ── 언제 ──
  let mt = 0;
  const later = () => { clearTimeout(mt); mt = setTimeout(() => { marks(); home(); }, 250); };
  document.addEventListener('barun:page', () => { keepNow.clear(); tipFor = null; sigBar = ''; missing.clear(); setTimeout(() => { nav(); marks(); }, 300); });
  let st = 0;
  window.addEventListener('scroll', () => { place(); if (tipFor && document.getElementById('wn-tip')?.hidden) { clearTimeout(st); st = setTimeout(() => { tipFor = null; marks(); }, 400); } }, { passive: true });   // 가리키던 칸이 화면 밖으로 나가면 보이는 다음 것으로
  window.addEventListener('resize', place);
  const start = () => {
    new MutationObserver(later).observe(document.querySelector('main.pages') || document.body, { childList: true, subtree: true, characterData: true });
    nav(); marks(); home();
    setInterval(() => { if (!document.hidden) { nav(); marks(); } }, 5000);   // 칸이 늦게 그려진 화면·4초 넘게 없는 칸
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.barunWhatsNew = { features: FEATURES, see, reset: () => { seen = {}; save(); keepNow.clear(); sigBar = sigHome = ''; nav(); marks(); home(); } };
})();
