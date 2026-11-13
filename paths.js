// 주문 경로 화면 — 진행 중인 주문마다 '어디까지 왔고 · 다음에 뭘 하고 · 누가 하나'(자동으로 해요 · 에이전트가 해요 · 사람이 해야 해요),
// 열린 사안(배분 엔진)과 구조 재설계 진척(2026-11-02 사장님: "단계별로 얼마나 진행되었는지 현황판에서", "'사람이 해야 해요' 식으로 쉽게").
// 읽기: GET /api/paths(barun/views/paths.py — 매시간 python -m barun 그림자가 만든 표). 보이는 말은 서버(barun/words.py)가 준 그대로 — 여기서 말을 만들지 않는다.
// 다만 서버 글에 섞여 오는 내부 이름(auto-orders·register.py·snake_case·영어 상태·이모지)은 화면에 내지 않게 plain()으로 걸러 보인다(2026-11-12 점검).
// 자리: index.html #p-paths(보임·숨김은 'barun:page' 이벤트). 쓰기 없음.
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const noE = (t) => (window.noEmoji ? window.noEmoji(t) : String(t ?? ''));
  // 서버 글 → 화면 글: 이모지·영어 상태 코드(koLabel)·자동 업무 id·파일 이름·코드 이름을 걷어 내고, 문장 사이 ' — '는 ' · '로
  const plain = (t) => (window.plainText ? window.plainText(t, { strict: true }) : noE(t));   // 화면 글 정리는 index.html plainText 한 곳
  const stamp = (iso) => (iso ? String(iso).slice(5, 16).replace('T', ' ').replace('-', '/') : '');
  const FILTERS = [['human', '사람이 해야 해요'], ['late', '막힌 주문'], ['all', '전체']];
  let timer = 0, busy = false, data = null, filter = 'human', caseAll = false;

  function install() {
    const sec = $('p-paths'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      .pa-hero h2 { font-size: 22px; line-height: 1.35; font-weight: 700; letter-spacing: -.025em; margin: 0 0 4px; }
      .pa-hero h2 em { font-style: normal; color: var(--blue); } .pa-hero h2 em.bad { color: var(--red); }
      .pa-hero .lead { color: var(--sub); margin: 0 0 16px; font-size: 14px; }
      .pa-hero .lead.err { color: var(--red-ink); }
      .pa-big .stat { cursor: default; }
      @media (min-width: 900px) { .pa-big { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
      /* 추이 — 숫자 나열 대신 작은 선 하나 + 처음·지금 값 */
      .pa-trend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 12px; font-size: 13px; color: var(--sub); }
      .pa-trend[hidden] { display: none; }
      .pa-trend svg { display: block; width: 128px; height: 32px; overflow: visible; flex: none; }
      .pa-trend .ln { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      .pa-trend .end { fill: currentColor; stroke: var(--card); stroke-width: 2; }
      .pa-trend .hit { fill: transparent; }
      .pa-trend .spark { color: var(--muted); } .pa-trend.worse .spark { color: var(--red); } .pa-trend.better .spark { color: var(--green); }
      .pa-trend b { color: var(--ink2); font-weight: 700; white-space: nowrap; } .pa-trend .dt { white-space: nowrap; font-variant-numeric: tabular-nums; }
      .pa-trend .chg { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; font-weight: 600; color: var(--ink2); }
      .pa-trend .chg .ic { width: 14px; height: 14px; } .pa-trend.worse .chg .ic { color: var(--red-ink); } .pa-trend.better .chg .ic { color: var(--green-ink); }
      /* 단계 띠 — 같은 너비 칸이 여러 줄로(옆으로 넘겨야 보이던 것), 0건은 옅게 */
      .pa-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 8px; }
      .pa-st { min-width: 0; border-radius: var(--r-sm); background: var(--fill2); box-shadow: inset 0 0 0 1px var(--line); padding: 12px; display: grid; gap: 4px; align-content: start; }
      @media (prefers-color-scheme: dark) { .pa-st { box-shadow: none; } }
      .pa-st .nm { font-size: 13px; font-weight: 600; color: var(--ink2); }
      .pa-st .n { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.2; letter-spacing: -.02em; }
      .pa-st .nx { font-size: 12px; color: var(--muted); }
      .pa-st .ov { font-size: 12px; color: var(--red-ink); font-weight: 600; }
      .pa-st.zero { background: transparent; } .pa-st.zero .n, .pa-st.zero .nm { color: var(--muted); } .pa-st.zero .n { font-weight: 600; }
      .pa-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin: 0 0 8px; }
      .pa-tabs button { all: unset; box-sizing: border-box; height: 32px; padding: 0 12px; border-radius: 999px; background: var(--fill); color: var(--ink2); font-size: 13px; font-weight: 600;
        cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; transition: background-color .18s var(--ease), color .18s var(--ease); }
      .pa-tabs button:hover { background: var(--hover); } .pa-tabs button:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
      .pa-tabs button[aria-pressed="true"] { background: var(--blue); color: #fff; }
      .pa-tabs .n { font-variant-numeric: tabular-nums; opacity: .75; }
      .pa-list { list-style: none; margin: 0; padding: 0; }
      .pa-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; padding: 12px 0; border-top: 1px solid var(--line); }
      .pa-list li:first-child { border-top: 0; } .pa-list li.none { display: block; color: var(--muted); font-size: 14px; padding: 16px 0; }
      .pa-list .t { font-size: 14px; color: var(--ink); min-width: 0; } .pa-list .s { font-size: 12.5px; color: var(--muted); grid-column: 1 / -1; min-width: 0; }
      .pa-who { font-size: 12px; font-weight: 600; line-height: 20px; padding: 0 8px; border-radius: 6px; background: var(--fill); color: var(--sub); white-space: nowrap; align-self: start; }
      .pa-who.human { background: var(--red-bg); color: var(--red-ink); } .pa-who.agent { background: var(--blue-bg); color: var(--blue-ink); }
      .pa-late { color: var(--red-ink); font-weight: 600; }
      .pa-more { margin-top: 8px; }
      .pa-rm summary { font-size: 13px; color: var(--sub); }
      .pa-rm .pa-list { margin-top: 8px; }
      .pa-rm li { grid-template-columns: 56px minmax(0, 1fr); align-items: start; }
      .pa-rm .mk { font-size: 12px; font-weight: 600; line-height: 20px; padding: 0 6px; border-radius: 6px; background: var(--fill); color: var(--sub); text-align: center; }
      .pa-rm .mk.done { background: var(--green-bg); color: var(--green-ink); } .pa-rm .mk.doing { background: var(--blue-bg); color: var(--blue-ink); }
      @media (max-width: 480px) { .pa-big > :last-child:nth-child(odd) { grid-column: 1 / -1; } .pa-hero h2 { font-size: 20px; } .pa-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;
    document.head.append(css);
    const card = (title, desc) => { const c = E('section', 'card'), h = E('div', 'card-h'); h.append(E('h2', null, title)); if (desc) h.append(E('span', 'desc', desc)); c.append(h); return c; };
    // 첫 카드 — 위 막대의 화면 이름을 되풀이하지 않고 한 문장 결론 + 숫자
    const top = E('section', 'card pa-hero');
    const h = E('h2', null, '불러오는 중…'); h.id = 'pa-head';
    const lead = E('p', 'lead', ''); lead.id = 'pa-at';
    const big = E('div', 'stats pa-big'); big.id = 'pa-big';
    const tr = E('div', 'pa-trend'); tr.id = 'pa-trend'; tr.hidden = true;
    top.append(h, lead, big, tr);
    const st = card('단계마다 몇 건', '왼쪽 위부터 차례로 진행돼요');
    const strip = E('div', 'pa-strip'); strip.id = 'pa-strip'; st.append(strip);
    const ls = card('주문 목록', '기한 넘긴 주문, 사람이 할 주문부터 보여요');
    const tabs = E('div', 'pa-tabs'); tabs.id = 'pa-tabs'; tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', '주문 거르기');
    for (const [k, label] of FILTERS) {
      const b = E('button'); b.type = 'button'; b.dataset.k = k; b.append(document.createTextNode(label), E('span', 'n', '')); b.setAttribute('aria-pressed', String(k === filter));
      if (k === 'late') b.title = '기한을 넘겼거나 한 단계에 너무 오래 머문 주문';
      b.onclick = () => { filter = k; for (const x of tabs.children) x.setAttribute('aria-pressed', String(x.dataset.k === k)); renderOrders(); };
      tabs.append(b);
    }
    const ol = E('ul', 'pa-list'); ol.id = 'pa-orders'; ls.append(tabs, ol);
    const cs = card('판단할 일', '에이전트가 먼저 보고, 못 끝내면 사람에게 넘겨요. 해결되면 저절로 닫혀요.');
    const ck = E('p', 'small muted', ''); ck.id = 'pa-case-kinds'; ck.style.margin = '0 0 4px';
    const cl = E('ul', 'pa-list'); cl.id = 'pa-cases'; cs.append(ck, cl);
    const sh = card('배대지 신청서', '신청서마다 머문 단계와 시간이에요. 정상 시간을 넘기면 ② 배대지 회차가 먼저 살피고, 그래도 그대로면 할 일 카드를 올려요.');
    const ss = E('div', 'pa-strip'); ss.id = 'pa-ships'; const sv = E('ul', 'pa-list'); sv.id = 'pa-ships-over'; sv.style.marginTop = '8px'; sh.append(ss, sv);
    const sk = card('재고', '사 둔 물건 중 아직 주문에 붙지 않은 것이에요. 매시간 새로 세어요.');
    const sl = E('ul', 'pa-list'); sl.id = 'pa-stock'; sk.append(sl);
    const ad = card('구매처·배대지 자동화', '— 표시는 아직 연결이 없는 곳이에요. 다음에 자동으로 만들 곳이에요.');
    const al = E('ul', 'pa-list'); al.id = 'pa-adapters'; ad.append(al);
    const rm = card('구조 재설계 진행', '');
    const rd = E('details', 'pa-rm'); const rs = E('summary', null, '항목 보기'); rs.id = 'pa-rm-sum'; const rl = E('ul', 'pa-list'); rl.id = 'pa-roadmap'; rd.append(rs, rl); rm.append(rd);
    sec.append(top, st, ls, cs, sh, sk, ad, rm);
    document.addEventListener('barun:page', (e) => { if (e.detail === 'paths') { load(); start(); } else stop(); });
    if (location.hash.split('?')[0] === '#paths') { load(); start(); }   // 이 화면 주소로 바로 열면 첫 'barun:page'가 설치 전에 지나감
    return true;
  }

  function stat(label, value, sub, cls) { const d = E('div', 'stat ' + (cls || '')); d.append(E('div', 'k', label), E('div', 'v', String(value)), E('div', 'd', sub || '')); d.title = sub || ''; return d; }
  const whoCls = (o) => (o.actor || o.who_key || '').includes('human') ? 'human' : (o.who_key === 'wait' ? 'wait' : 'agent');
  const ord = (o) => (filter === 'all' || (filter === 'late' ? (o.late || o.over) : String(o.actor || '').includes('human')));

  function renderOrders() {
    const ol = $('pa-orders'); if (!ol || !data) return; ol.innerHTML = '';
    for (const b of $('pa-tabs').children) { const k = b.dataset.k; b.lastChild.textContent = String(data.orders.filter((o) => k === 'all' || (k === 'late' ? (o.late || o.over) : String(o.actor || '').includes('human'))).length); }
    const rows = data.orders.filter(ord);
    if (!rows.length) { ol.append(E('li', 'none', { human: '사람이 해야 하는 주문이 없어요.', late: '막힌 주문이 없어요.', all: '진행 중인 주문이 없어요.' }[filter])); return; }
    for (const o of rows.slice(0, 80)) {
      const li = E('li');
      const t = E('div', 't'); if (o.late) t.append(E('span', 'pa-late', '기한 넘김 · ')); else if (o.over) t.append(E('span', 'pa-late', '오래 머묾 · '));
      t.append(document.createTextNode(`${o.where} ${o.receiver} · ${o.product}`));
      if (o.account && window.acctTag) { t.append(' '); t.append(window.acctTag(o.account, o.account_label)); }   // 다른 쿠팡 판매 계정 주문(2026-11-13)
      const by = plain(o.by);
      li.append(t);
      // 거르기가 이미 '사람이 해야 해요'면 줄마다 같은 표시를 되풀이하지 않음
      if (filter !== 'human' || whoCls(o) !== 'human') li.append(E('span', 'pa-who ' + whoCls(o), plain(o.who)));
      li.append(E('div', 's', `${o.stage_name}` + (o.hours != null ? `(${Math.round(o.hours)}시간째)` : '') + ` → ${plain(o.next)}` + (o.due ? ` · 발송기한 ${o.due.slice(5)}` : '') + (by ? ` · ${by}` : '')));
      ol.append(li);
    }
  }

  // 사람 몫 추이 — 작은 선(하루 평균), 처음 값과 지금 값, 늘었는지 줄었는지
  function trend(T) {
    const tr = $('pa-trend'); tr.textContent = ''; tr.className = 'pa-trend';
    const vs = T.map((x) => +x['사람 몫 %']).filter((v) => Number.isFinite(v));
    tr.hidden = vs.length < 2; if (tr.hidden) return;
    const a0 = vs[0], a1 = vs[vs.length - 1], W = 128, H = 32, P = 4;
    const lo = Math.min(...vs), hi = Math.max(...vs), y = (v) => (hi === lo ? H / 2 : P + (H - 2 * P) * (1 - (v - lo) / (hi - lo))), x = (i) => P + (W - 2 * P) * (i / (vs.length - 1));
    if (a1 !== a0) tr.classList.add(a1 > a0 ? 'worse' : 'better');
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'spark'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', '사람 몫 추이 ' + T.map((d) => `${d.day.slice(5)} ${d['사람 몫 %']}%`).join(', '));
    const pl = document.createElementNS(NS, 'polyline'); pl.setAttribute('class', 'ln'); pl.setAttribute('points', vs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')); svg.append(pl);
    T.forEach((d, i) => {   // 점마다 마우스를 올리면 그날 값
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('class', 'hit'); c.setAttribute('cx', x(i)); c.setAttribute('cy', y(vs[i])); c.setAttribute('r', 8);
      const ti = document.createElementNS(NS, 'title'); ti.textContent = `${d.day.slice(5).replace('-', '/')} 사람 몫 ${d['사람 몫 %']}%`; c.append(ti); svg.append(c);
    });
    const end = document.createElementNS(NS, 'circle'); end.setAttribute('class', 'end'); end.setAttribute('cx', x(vs.length - 1)); end.setAttribute('cy', y(a1)); end.setAttribute('r', 4); svg.append(end);
    const d0 = T[0].day.slice(5).replace('-', '/');
    tr.append(E('span', null, '사람 몫 추이'), svg, E('b', null, `${a1}%`), E('span', 'dt', `${d0} ${a0}%에서`));
    if (a1 !== a0) {
      const ch = E('span', 'chg'); ch.innerHTML = window.ico ? window.ico(a1 > a0 ? 'up' : 'down') : '';
      ch.append(document.createTextNode(a1 > a0 ? `${(a1 - a0).toFixed(1)}%p 늘었어요` : `${(a0 - a1).toFixed(1)}%p 줄었어요`)); tr.append(ch);
    }
    tr.append(E('span', 'muted small', '하루 평균 · 낮을수록 좋아요'));
  }

  function render(d) {
    data = d; const s = d.summary;
    const at = d.at ? d.at.slice(11, 16) : '';
    // 2026-11-06: 업무 흐름 화면 숫자(133·6·51)와 달라 헷갈려서 — 무엇을 언제 셌는지 설명에(여기는 매시간 셈, 국내 배송 중 뺌, 카드 아닌 사안)
    const head = $('pa-head'); head.textContent = '';
    const n = s['진행 중'], hn = s['사람이 해야 해요'];
    if (hn) head.append(document.createTextNode(`진행 중인 주문 ${n}건 중 `), E('em', 'bad', `${hn}건`), document.createTextNode('이 사람 차례예요'));
    else head.append(document.createTextNode(`진행 중인 주문 ${n}건이 모두 자동으로 가고 있어요`));
    const lead = $('pa-at'); lead.className = 'lead'; lead.title = '';
    lead.textContent = `${stamp(d.at)} 갱신 · 매시간 다시 세고, 국내 배송 중인 주문은 빼요`;
    const big = $('pa-big'); big.innerHTML = '';
    const pct = +s['사람이 해야 하는 몫 %'];
    big.append(stat('진행 중 주문', `${n}건`, `고객 주문 단위 · ${at} 기준`),
      stat('사람 몫', `${s['사람이 해야 하는 몫 %']}%`, `${hn}건 · 목표 2% 미만`, pct >= 2 ? 'bad' : 'ok'),
      stat('발송기한 넘김', `${s['발송기한 넘김']}건`, `${at} 기준 · 지금 숫자는 업무 흐름에서`, s['발송기한 넘김'] ? 'warn' : ''),
      stat('사람이 판단할 일', `${s['사람이 볼 사안']}건`, `전체 ${s['열린 사안']}건 중 · 할 일 카드와 별도`, s['사람이 볼 사안'] ? 'warn' : ''));
    trend(d.trend || []);
    const strip = $('pa-strip'); strip.innerHTML = '';
    for (const x of d.stages) {
      const b = E('div', 'pa-st' + (x.n ? '' : ' zero')); b.append(E('div', 'nm', x.name), E('div', 'n', String(x.n)), E('div', 'nx', plain(x.next)));
      if (x.n && x.max_hours) b.append(E('div', 'nx', `가장 오래 ${Math.round(x.max_hours)}시간째`));
      strip.append(b);
    }
    renderOrders();
    renderCases();
    const SH = d.ships || {}; const ss = $('pa-ships'); ss.innerHTML = ''; const sv = $('pa-ships-over'); sv.innerHTML = '';
    for (const [name, v] of Object.entries(SH['단계'] || {})) {
      const b = E('div', 'pa-st' + (v.n ? '' : ' zero')); b.append(E('div', 'nm', name), E('div', 'n', String(v.n)));
      if (v.over) b.append(E('div', 'ov', `정상 시간 넘김 ${v.over}`)); ss.append(b);
    }
    if (!(SH['정상 시간 넘김'] || []).length) sv.append(E('li', 'none', SH['진행 중 신청서'] != null ? `진행 중 ${SH['진행 중 신청서']}건, 정상 시간을 넘긴 신청서는 없어요.` : '배대지 자료가 아직 없어요. 다음 집계 때 채워져요.'));
    for (const t of (SH['정상 시간 넘김'] || []).slice(0, 30)) { const li = E('li'); li.append(E('div', 't', plain(t)), E('span', 'pa-who agent', '② 회차가 확인 중')); sv.append(li); }
    const lost = Object.entries(SH).find(([k]) => k.startsWith('30일 넘음'));
    for (const t of (lost ? lost[1] : []) || []) { const li = E('li'); li.append(E('div', 't', plain(t)), E('span', 'pa-who human', '분실 검토')); sv.append(li); }
    const sl = $('pa-stock'); sl.innerHTML = '';
    const sd = d.stock || { items: [] };
    if (!sd.items.length) sl.append(E('li', 'none', '주문에 안 붙은 재고가 없어요.'));
    for (const g of sd.items.slice(0, 40)) {
      const site = window.koLabel ? window.koLabel(g.site) : g.site;
      const li = E('li'); li.append(E('div', 't', `${g.name}`), E('span', 'pa-who ' + (g.what === '재고' ? 'agent' : 'human'), `${g.what} ${g.n}통`),
        E('div', 's', `${site} 주문 ${g.orders}` + (g.where ? ` · ${g.where}` : ''))); sl.append(li);
    }
    const al = $('pa-adapters'); al.innerHTML = '';
    const A = d.adapters || { shops: [], forwarders: [] };
    const cap = (v) => (v ? (v.startsWith('auto') ? '자동' : '사람') : '—');
    for (const s2 of A.shops) {
      const li = E('li'); li.append(E('div', 't', `구매처 ${window.koLabel ? window.koLabel(s2.site) : s2.site}`), E('span', 'pa-who ' + (s2.cart ? 'agent' : 'human'), s2.cart ? (s2.pay === 'human' ? '결제만 사람이 해요' : '자동으로 사요') : '사람이 사요'),
        E('div', 's', `주문 읽기 ${cap(s2.read)} · 담기 ${cap(s2.cart)} · 결제 ${cap(s2.pay)} · 주문 메일 ${cap(s2.mail)}`)); al.append(li);
    }
    for (const f of A.forwarders) {
      const li = E('li'); li.append(E('div', 't', `배대지 ${window.koLabel ? window.koLabel(f.name) : f.name}`),
        E('div', 's', `현황 ${cap(f.status)} · 신청 ${cap(f.apply)} · 배송비 결제 ${cap(f.pay)} · 1:1 문의 ${cap(f.ask)}`)); al.append(li);
    }
    const rl = $('pa-roadmap'); rl.innerHTML = '';
    const RM = { done: '완료', doing: '진행 중', todo: '예정' };
    for (const t of d.roadmap) {
      const full = plain(t.title), short = full.split(' · ')[0];
      const li = E('li'); const tt = E('div', 't', `${t.phase}단계 · ${short}`); tt.title = full;
      li.append(E('span', 'mk ' + (t.state || ''), RM[t.state] || t.state), tt); rl.append(li);
    }
    const done = d.roadmap.filter((t) => t.state === 'done').length;
    $('pa-rm-sum').textContent = `${d.roadmap.length}개 중 ${done}개 완료 · 항목 보기`;
  }

  function renderCases() {
    const d = data, cl = $('pa-cases'); cl.innerHTML = '';
    if (!d.cases.length) cl.append(E('li', 'none', '열린 판단할 일이 없어요.'));
    const KIND = { card: '옛 카드', watch: '감시', 'listing.check': '등록 확인', 'ship.late': '배대지 오래 머묾', 'order.late': '막힌 주문', 'order.buy': '공홈에서 살 주문',
      'order.office': '사업장 경유', 'orders.ask': '답 없는 문의', 'orders.stuck': '센터 입고 전', 'orders.stock': '재고 장부', 'unit.free': '어느 줄에도 없는 물건',
      'product.shop': '구매처 정하기', 'purchase.who': '누구 몫', 'shipment.replace': '신청서 바꿈', 'dispatch.dup': '발송 멈춤', 'review.low': '낮은 리뷰', 'inquiry.date': '문의 날짜' };
    const byKind = {}; for (const c of d.cases) { const k = byKind[c.kind] || (byKind[c.kind] = { n: 0, h: 0 }); k.n++; if (c.who_key === 'human') k.h++; }
    $('pa-case-kinds').textContent = Object.entries(byKind).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${KIND[k] || plain(k) || '기타'} ${v.n}` + (v.h ? `(사람 ${v.h})` : '')).join(' · ');
    const LIM = 20, list = caseAll ? d.cases : d.cases.slice(0, LIM);
    for (const c of list) {
      const why = plain(c.why), li = E('li');
      li.append(E('div', 't', plain(c.title)), E('span', 'pa-who ' + whoCls(c), plain(c.who)), E('div', 's', (KIND[c.kind] || '기타') + (why ? ' · ' + why : '')));
      if (c.why && why !== noE(c.why)) li.title = `원문: ${noE(c.why)}`;
      cl.append(li);
    }
    if (d.cases.length > LIM) {
      const li = E('li', 'none'); const b = E('button', 'btn ghost sm pa-more', caseAll ? '접기' : `${d.cases.length - LIM}건 더 보기`); b.type = 'button';
      b.onclick = () => { caseAll = !caseAll; renderCases(); }; li.append(b); cl.append(li);
    }
  }

  async function load() {
    if (busy) return; busy = true;
    // 2026-11-06: 503이면 빈 칸만 남아 '없어요'처럼 보이던 것 → 실패를 보임(읽은 적 있으면 그대로 두고 한 줄만, 원문은 마우스를 올리면)
    try {
      const r = await (window.barunFetch || fetch)('/api/paths');
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      render(await r.json());
    } catch (e) {
      if (e.message === '로그인 필요') return;
      if (!data) $('pa-head').textContent = '주문 경로를 읽지 못했어요';
      const lead = $('pa-at'); lead.className = 'lead err'; lead.title = `원문: ${e.message}`;
      lead.textContent = '1분 뒤에 다시 읽어요.' + (data ? ' 지금 보이는 건 마지막으로 읽은 내용이에요.' : '');
    } finally { busy = false; }
  }
  function start() { stop(); timer = setInterval(() => { if (!document.hidden) load(); }, 60000); }
  function stop() { if (timer) clearInterval(timer); timer = 0; }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
