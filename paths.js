// 주문 경로 화면 — 진행 중인 주문마다 '어디까지 왔고 · 다음에 뭘 하고 · 누가 하나'(자동으로 해요 · 에이전트가 해요 · 사람이 해야 해요),
// 열린 사안(배분 엔진)과 구조 재설계 진척(2026-11-02 사장님: "단계별로 얼마나 진행되었는지 현황판에서", "'사람이 해야 해요' 식으로 쉽게").
// 읽기: GET /api/paths(barun/views/paths.py — 매시간 python -m barun 그림자가 만든 표). 보이는 말은 서버(barun/words.py)가 준 그대로 — 여기서 말을 만들지 않는다.
// 자리: index.html #p-paths(보임·숨김은 'barun:page' 이벤트). 쓰기 없음.
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  let timer = 0, busy = false, data = null, filter = 'human';

  function install() {
    const sec = $('p-paths'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      .pa-big { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .pa-big > div { background: var(--card); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 12px 14px; }
      .pa-big b { display: block; font-size: 26px; font-variant-numeric: tabular-nums; margin-top: 2px; }
      .pa-big span { font-size: 12px; color: var(--muted); }
      .pa-strip { display: flex; gap: 6px; overflow-x: auto; padding: 4px 2px 8px; }
      .pa-st { flex: 0 0 auto; min-width: 104px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--card); padding: 8px 10px; }
      .pa-st .nm { font-size: 13px; font-weight: 600; } .pa-st .nx { font-size: 11px; color: var(--muted); margin-top: 2px; word-break: keep-all; }
      .pa-st .n { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 4px; }
      .pa-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0 10px; }
      .pa-tabs button { font: inherit; font-size: 13px; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--card); color: inherit; cursor: pointer; }
      .pa-tabs button[aria-pressed="true"] { border-color: var(--blue); color: var(--blue); }
      .pa-list { list-style: none; margin: 0; padding: 0; }
      .pa-list li { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
      .pa-list .t { font-size: 14px; } .pa-list .s { font-size: 12px; color: var(--muted); grid-column: 1 / -1; }
      .pa-who { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--fill); white-space: nowrap; align-self: start; }
      .pa-who.human { background: var(--st-crit-bg, #fdecec); color: var(--st-crit); } .pa-who.agent, .pa-who.wait { color: var(--sub); }
      .pa-late { color: var(--st-crit); font-weight: 600; }
      .pa-rm li { grid-template-columns: auto 1fr; } .pa-rm .mk { font-size: 12px; color: var(--muted); width: 54px; }
      /* 2026-11-06: 추이 줄이 칸에 붙어 있었고, 오른다(나빠짐)는 게 안 보였음 */
      #pa-trend { margin-top: 10px; } #pa-trend.worse b { color: var(--st-crit); } #pa-trend.better b { color: var(--st-good); }
      /* 2026-11-06: 단계 띠가 옆으로 넘쳐도 표시가 없었음 → 넘치는 쪽 가장자리 흐림 */
      .pa-strip.fade-r { -webkit-mask-image: linear-gradient(90deg, #000 85%, transparent); mask-image: linear-gradient(90deg, #000 85%, transparent); }
      .pa-strip.fade-l { -webkit-mask-image: linear-gradient(90deg, transparent, #000 15%); mask-image: linear-gradient(90deg, transparent, #000 15%); }
      .pa-strip.fade-l.fade-r { -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
      @media (max-width: 900px) { .pa-big { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;
    sec.append(css,
      E('div', 'card', null),
    );
    const top = sec.lastChild;
    top.append(E('div', 'card-h', null));
    top.firstChild.append(E('h2', null, '주문 경로'), E('span', 'desc', '진행 중인 주문이 어디까지 왔고, 누가 하고 있는지'));
    const big = E('div', 'pa-big'); big.id = 'pa-big'; const tr = E('div', 'desc', ''); tr.id = 'pa-trend'; top.append(big, tr, E('div', 'desc', ''));
    top.lastChild.id = 'pa-at';
    const st = E('div', 'card'); st.append(E('div', 'card-h')); st.firstChild.append(E('h2', null, '단계마다 몇 건'), E('span', 'desc', '왼쪽에서 오른쪽으로 진행해요'));
    const strip = E('div', 'pa-strip'); strip.id = 'pa-strip'; st.append(strip);
    const ls = E('div', 'card'); ls.append(E('div', 'card-h')); ls.firstChild.append(E('h2', null, '주문마다'), E('span', 'desc', '기한 넘김과 사람이 해야 하는 것이 먼저'));
    const tabs = E('div', 'pa-tabs'); tabs.id = 'pa-tabs';
    for (const [k, label] of [['human', '사람이 해야 해요'], ['late', '막힌 주문(기한 넘김·너무 오래)'], ['all', '전부']]) {
      const b = E('button', null, label); b.dataset.k = k; b.setAttribute('aria-pressed', String(k === filter));
      b.onclick = () => { filter = k; for (const x of tabs.children) x.setAttribute('aria-pressed', String(x.dataset.k === k)); renderOrders(); };
      tabs.append(b);
    }
    const ol = E('ul', 'pa-list'); ol.id = 'pa-orders'; ls.append(tabs, ol);
    const cs = E('div', 'card'); cs.append(E('div', 'card-h')); cs.firstChild.append(E('h2', null, '판단할 일(사안)'), E('span', 'desc', '에이전트가 먼저 하고, 못 하면 사람에게 와요 · 해결되면 저절로 닫혀요'));
    const ck = E('div', 'desc', ''); ck.id = 'pa-case-kinds';
    const cl = E('ul', 'pa-list'); cl.id = 'pa-cases'; cs.append(ck, cl);
    const sh = E('div', 'card'); sh.append(E('div', 'card-h')); sh.firstChild.append(E('h2', null, '배대지 신청서 단계'), E('span', 'desc', '배대지에 낸 신청서가 어디서 몇 시간째인지 — 정상 시간을 넘기면 ②가 먼저 보고, 그대로면 카드 한 장'));
    const ss = E('div', 'pa-strip'); ss.id = 'pa-ships'; const sv = E('ul', 'pa-list'); sv.id = 'pa-ships-over'; sh.append(ss, sv);
    const sk = E('div', 'card'); sk.append(E('div', 'card-h')); sk.firstChild.append(E('h2', null, '재고(물건 장부)'), E('span', 'desc', '산 물건 중 아직 고객에게 안 붙은 것 — 매시간 다시 셈'));
    const sl = E('ul', 'pa-list'); sl.id = 'pa-stock'; sk.append(sl);
    const ad = E('div', 'card'); ad.append(E('div', 'card-h')); ad.firstChild.append(E('h2', null, '연결부 — 어디가 자동인가'), E('span', 'desc', '빈칸(—)이 다음에 자동으로 만들 곳'));
    const al = E('ul', 'pa-list'); al.id = 'pa-adapters'; ad.append(al);
    const rm = E('div', 'card'); rm.append(E('div', 'card-h')); rm.firstChild.append(E('h2', null, '구조 재설계 진척'), E('span', 'desc', '할 일마다 끝 · 진행 중 · 할 일'));
    const rl = E('ul', 'pa-list pa-rm'); rl.id = 'pa-roadmap'; rm.append(rl);
    sec.append(st, ls, cs, sh, sk, ad, rm);
    document.addEventListener('barun:page', (e) => { if (e.detail === 'paths') { load(); start(); } else stop(); });
    if (location.hash.split('?')[0] === '#paths') { load(); start(); }   // 이 화면 주소로 바로 열면 첫 'barun:page'가 설치 전에 지나감
    return true;
  }

  const edges = (el) => { const f = () => { el.classList.toggle('fade-l', el.scrollLeft > 2); el.classList.toggle('fade-r', el.scrollLeft + el.clientWidth < el.scrollWidth - 2); };
    if (!el._edge) { el._edge = f; el.addEventListener('scroll', f, { passive: true }); window.addEventListener('resize', f); } requestAnimationFrame(f); };
  function stat(label, value, sub) { const d = E('div'); d.append(E('span', null, label), E('b', null, String(value)), E('span', null, sub || '')); return d; }
  const whoCls = (o) => (o.actor || o.who_key || '').includes('human') ? 'human' : (o.who_key === 'wait' ? 'wait' : 'agent');

  function renderOrders() {
    const ol = $('pa-orders'); if (!ol || !data) return; ol.innerHTML = '';
    const rows = data.orders.filter((o) => filter === 'all' || (filter === 'late' ? (o.late || o.over) : String(o.actor || '').includes('human')));
    if (!rows.length) { ol.append(E('li', null, filter === 'human' ? '사람이 해야 하는 주문이 없어요' : '없어요')); return; }
    for (const o of rows.slice(0, 80)) {
      const li = E('li');
      const t = E('div', 't'); if (o.late) t.append(E('span', 'pa-late', '기한 넘김 · ')); else if (o.over) t.append(E('span', 'pa-late', '너무 오래 머묾 · '));
      t.append(document.createTextNode(`${o.where} ${o.receiver} · ${o.product}`));
      li.append(t, E('span', 'pa-who ' + whoCls(o), o.who),
        E('div', 's', `${o.stage_name}` + (o.hours != null ? `(${Math.round(o.hours)}시간째)` : '') + ` → ${o.next}` + (o.due ? ` · 발송기한 ${o.due.slice(5)}` : '') + (o.by ? ` · ${o.by}` : '')));
      ol.append(li);
    }
  }

  function render(d) {
    data = d; const s = d.summary;
    const big = $('pa-big'); big.innerHTML = '';
    // 2026-11-06: 업무 흐름 화면 숫자(133·6·51)와 달라 헷갈려서 — 무엇을 언제 셌는지 이름·설명에(여기는 매시간 셈, 국내 배송 중 뺌, 카드 아닌 사안)
    const at = d.at ? d.at.slice(11, 16) : '';
    big.append(stat('진행 중인 주문(배송 중 뺌)', `${s['진행 중']}건`, `고객 주문 단위 · ${at} 셈`), stat('사람이 해야 하는 몫', `${s['사람이 해야 하는 몫 %']}%`, `${s['사람이 해야 해요']}건 · 목표 2% 미만`),
      stat('발송기한 넘김', `${s['발송기한 넘김']}건`, `${at} 셈 · 지금 숫자는 업무 흐름 화면`), stat('사람이 볼 판단할 일', `${s['사람이 볼 사안']}건`, `열린 사안 ${s['열린 사안']}건 중 · #할-일 카드와 따로 셈`));
    const T = d.trend || [], tr = $('pa-trend'); tr.textContent = ''; tr.className = 'desc';
    // 2026-11-06: '나아지는 정도 22% → 52%'는 실제로 나빠진 것 — 낮을수록 좋다고 적고, 오르면 빨강·내리면 초록
    if (T.length) {
      const a0 = +T[0]['사람 몫 %'], a1 = +T[T.length - 1]['사람 몫 %'];
      if (T.length > 1 && a1 !== a0) tr.classList.add(a1 > a0 ? 'worse' : 'better');
      tr.append(document.createTextNode('사람 몫 추이(하루 평균 · 낮을수록 좋음): ' + T.map((x) => `${x.day.slice(5)} ${x['사람 몫 %']}%`).join(' → ') + ' '));
      if (T.length > 1 && a1 !== a0) tr.append(E('b', null, a1 > a0 ? `${(a1 - a0).toFixed(1)}%p 늘어 나빠졌어요` : `${(a0 - a1).toFixed(1)}%p 줄어 나아졌어요`));
    }
    $('pa-at').textContent = d.at ? `${d.at.slice(5, 16).replace('T', ' ')}에 다시 셈(매시간)` : '';
    const strip = $('pa-strip'); strip.innerHTML = '';
    for (const x of d.stages) { const b = E('div', 'pa-st'); b.append(E('div', 'nm', x.name), E('div', 'nx', x.next), E('div', 'n', String(x.n)), E('div', 'nx', x.n && x.max_hours ? `가장 오래 ${Math.round(x.max_hours)}시간째` : '')); strip.append(b); }
    edges(strip);
    renderOrders();
    const cl = $('pa-cases'); cl.innerHTML = '';
    if (!d.cases.length) cl.append(E('li', null, '열린 판단할 일이 없어요'));
    const KIND = { card: '옛 카드(장부에 올림)', watch: '감시', 'listing.check': '등록 확인', 'ship.late': '배대지 오래 머묾', 'order.late': '막힌 주문', 'order.buy': '공홈에서 살 주문',
      'order.office': '사업장 경유', 'orders.ask': '답 없는 문의', 'orders.stuck': '센터 입고 전', 'orders.stock': '재고 장부', 'unit.free': '어느 줄에도 없는 물건',
      'product.shop': '구매처 정하기', 'purchase.who': '누구 몫', 'shipment.replace': '신청서 바꿈', 'dispatch.dup': '발송 멈춤' };
    const byKind = {}; for (const c of d.cases) { const k = byKind[c.kind] || (byKind[c.kind] = { n: 0, h: 0 }); k.n++; if (c.who_key === 'human') k.h++; }
    $('pa-case-kinds').textContent = Object.entries(byKind).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${KIND[k] || k} ${v.n}` + (v.h ? `(사람 ${v.h})` : '')).join(' · ');
    for (const c of d.cases) { const li = E('li'); li.append(E('div', 't', c.title), E('span', 'pa-who ' + whoCls(c), c.who), E('div', 's', (KIND[c.kind] || c.kind) + (c.why ? ' · ' + c.why : ''))); cl.append(li); }
    const SH = d.ships || {}; const ss = $('pa-ships'); ss.innerHTML = ''; const sv = $('pa-ships-over'); sv.innerHTML = '';
    for (const [name, v] of Object.entries(SH['단계'] || {})) { const b = E('div', 'pa-st'); b.append(E('div', 'nm', name), E('div', 'n', String(v.n)), E('div', 'nx', v.over ? `정상 시간 넘김 ${v.over}` : '')); ss.append(b); }
    if (!(SH['정상 시간 넘김'] || []).length) sv.append(E('li', null, SH['진행 중 신청서'] != null ? `진행 중 ${SH['진행 중 신청서']}건 — 정상 시간을 넘긴 신청서가 없어요` : '배대지 자료가 아직 없어요'));
    for (const t of (SH['정상 시간 넘김'] || []).slice(0, 30)) { const li = E('li'); li.append(E('div', 't', t), E('span', 'pa-who agent', '②가 먼저 봐요')); sv.append(li); }
    for (const t of (SH['30일 넘음(분실 검토 — 재고 장부 사안)'] || [])) { const li = E('li'); li.append(E('div', 't', t), E('span', 'pa-who human', '분실 검토')); sv.append(li); }
    edges(ss);
    const sl = $('pa-stock'); sl.innerHTML = '';
    const sd = d.stock || { items: [] };
    if (!sd.items.length) sl.append(E('li', null, '재고가 없어요'));
    for (const g of sd.items.slice(0, 40)) {
      const li = E('li'); li.append(E('div', 't', `${g.name}`), E('span', 'pa-who ' + (g.what === '재고' ? 'agent' : 'human'), `${g.what} ${g.n}통`),
        E('div', 's', `${g.site} 주문 ${g.orders}` + (g.where ? ` · ${g.where}` : ''))); sl.append(li);
    }
    const al = $('pa-adapters'); al.innerHTML = '';
    const A = d.adapters || { shops: [], forwarders: [] };
    const cap = (v) => (v ? (v.startsWith('auto') ? '자동' : '사람') : '—');
    for (const s of A.shops) { const li = E('li'); li.append(E('div', 't', `구매처 ${s.site}`), E('span', 'pa-who ' + (s.cart ? 'agent' : 'human'), s.cart ? (s.pay === 'human' ? '결제만 사람' : '자동으로 사요') : '사람이 사요'),
      E('div', 's', `주문 읽기 ${cap(s.read)} · 담기 ${cap(s.cart)} · 결제 ${cap(s.pay)} · 주문 메일 ${cap(s.mail)}`)); al.append(li); }
    for (const f of A.forwarders) { const li = E('li'); li.append(E('div', 't', `배대지 ${f.name}`), E('span', 'pa-who agent', ''),
      E('div', 's', `현황 ${cap(f.status)} · 신청 ${cap(f.apply)} · 배송비 결제 ${cap(f.pay)} · 1:1 ${cap(f.ask)}`)); al.append(li); }
    const rl = $('pa-roadmap'); rl.innerHTML = '';
    for (const t of d.roadmap) { const li = E('li'); li.append(E('span', 'mk', { done: '끝', doing: '진행 중', todo: '할 일' }[t.state] || t.state), E('div', 't', `${t.phase}단계 · ${t.title}`)); rl.append(li); }
  }

  async function load() {
    if (busy) return; busy = true;
    // 2026-11-06: 503이면 빈 칸만 남아 '없어요'처럼 보이던 것 → 실패를 보임(읽은 적 있으면 그대로 두고 한 줄만)
    try {
      const r = await (window.barunFetch || fetch)('/api/paths');
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      render(await r.json());
    } catch (e) {
      if (e.message !== '로그인 필요') $('pa-at').textContent = `주문 경로를 읽지 못했어요(${e.message}) — 잠시 뒤 다시 읽어요.` + (data ? ' 위는 마지막으로 읽은 내용이에요.' : '');
    } finally { busy = false; }
  }
  function start() { stop(); timer = setInterval(() => { if (!document.hidden) load(); }, 60000); }
  function stop() { if (timer) clearInterval(timer); timer = 0; }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
