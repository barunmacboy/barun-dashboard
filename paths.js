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
      @media (max-width: 900px) { .pa-big { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;
    sec.append(css,
      E('div', 'card', null),
    );
    const top = sec.lastChild;
    top.append(E('div', 'card-h', null));
    top.firstChild.append(E('h2', null, '주문 경로'), E('span', 'desc', '진행 중인 주문이 어디까지 왔고, 누가 하고 있는지'));
    const big = E('div', 'pa-big'); big.id = 'pa-big'; top.append(big, E('div', 'desc', ''));
    top.lastChild.id = 'pa-at';
    const st = E('div', 'card'); st.append(E('div', 'card-h')); st.firstChild.append(E('h2', null, '단계마다 몇 건'), E('span', 'desc', '왼쪽에서 오른쪽으로 진행해요'));
    const strip = E('div', 'pa-strip'); strip.id = 'pa-strip'; st.append(strip);
    const ls = E('div', 'card'); ls.append(E('div', 'card-h')); ls.firstChild.append(E('h2', null, '주문마다'), E('span', 'desc', '기한 넘김과 사람이 해야 하는 것이 먼저'));
    const tabs = E('div', 'pa-tabs'); tabs.id = 'pa-tabs';
    for (const [k, label] of [['human', '사람이 해야 해요'], ['late', '발송기한 넘김'], ['all', '전부']]) {
      const b = E('button', null, label); b.dataset.k = k; b.setAttribute('aria-pressed', String(k === filter));
      b.onclick = () => { filter = k; for (const x of tabs.children) x.setAttribute('aria-pressed', String(x.dataset.k === k)); renderOrders(); };
      tabs.append(b);
    }
    const ol = E('ul', 'pa-list'); ol.id = 'pa-orders'; ls.append(tabs, ol);
    const cs = E('div', 'card'); cs.append(E('div', 'card-h')); cs.firstChild.append(E('h2', null, '판단할 일(사안)'), E('span', 'desc', '에이전트가 먼저 하고, 못 하면 사람에게 와요 · 해결되면 저절로 닫혀요'));
    const cl = E('ul', 'pa-list'); cl.id = 'pa-cases'; cs.append(cl);
    const rm = E('div', 'card'); rm.append(E('div', 'card-h')); rm.firstChild.append(E('h2', null, '구조 재설계 진척'), E('span', 'desc', '할 일마다 끝 · 진행 중 · 할 일'));
    const rl = E('ul', 'pa-list pa-rm'); rl.id = 'pa-roadmap'; rm.append(rl);
    sec.append(st, ls, cs, rm);
    document.addEventListener('barun:page', (e) => { if (e.detail === 'paths') { load(); start(); } else stop(); });
    if (location.hash.split('?')[0] === '#paths') { load(); start(); }   // 이 화면 주소로 바로 열면 첫 'barun:page'가 설치 전에 지나감
    return true;
  }

  function stat(label, value, sub) { const d = E('div'); d.append(E('span', null, label), E('b', null, String(value)), E('span', null, sub || '')); return d; }
  const whoCls = (o) => (o.actor || o.who_key || '').includes('human') ? 'human' : (o.who_key === 'wait' ? 'wait' : 'agent');

  function renderOrders() {
    const ol = $('pa-orders'); if (!ol || !data) return; ol.innerHTML = '';
    const rows = data.orders.filter((o) => filter === 'all' || (filter === 'late' ? o.late : o.actor.includes('human')));
    if (!rows.length) { ol.append(E('li', null, filter === 'human' ? '사람이 해야 하는 주문이 없어요' : '없어요')); return; }
    for (const o of rows.slice(0, 80)) {
      const li = E('li');
      const t = E('div', 't'); if (o.late) t.append(E('span', 'pa-late', '기한 넘김 · '));
      t.append(document.createTextNode(`${o.where} ${o.receiver} · ${o.product}`));
      li.append(t, E('span', 'pa-who ' + whoCls(o), o.who),
        E('div', 's', `${o.stage_name} → ${o.next}` + (o.due ? ` · 발송기한 ${o.due.slice(5)}` : '') + (o.by ? ` · ${o.by}` : '')));
      ol.append(li);
    }
  }

  function render(d) {
    data = d; const s = d.summary;
    const big = $('pa-big'); big.innerHTML = '';
    big.append(stat('진행 중인 주문', `${s['진행 중']}건`, ''), stat('사람이 해야 하는 몫', `${s['사람이 해야 하는 몫 %']}%`, `${s['사람이 해야 해요']}건 · 목표 2% 미만`),
      stat('발송기한 넘김', `${s['발송기한 넘김']}건`, ''), stat('사람이 볼 판단할 일', `${s['사람이 볼 사안']}건`, `열린 사안 ${s['열린 사안']}건 중`));
    $('pa-at').textContent = d.at ? `${d.at.slice(5, 16).replace('T', ' ')}에 다시 셈(매시간)` : '';
    const strip = $('pa-strip'); strip.innerHTML = '';
    for (const x of d.stages) { const b = E('div', 'pa-st'); b.append(E('div', 'nm', x.name), E('div', 'nx', x.next), E('div', 'n', String(x.n))); strip.append(b); }
    renderOrders();
    const cl = $('pa-cases'); cl.innerHTML = '';
    if (!d.cases.length) cl.append(E('li', null, '열린 판단할 일이 없어요'));
    for (const c of d.cases) { const li = E('li'); li.append(E('div', 't', c.title), E('span', 'pa-who ' + whoCls(c), c.who), E('div', 's', c.why || '')); cl.append(li); }
    const rl = $('pa-roadmap'); rl.innerHTML = '';
    for (const t of d.roadmap) { const li = E('li'); li.append(E('span', 'mk', { done: '끝', doing: '진행 중', todo: '할 일' }[t.state] || t.state), E('div', 't', `${t.phase}단계 · ${t.title}`)); rl.append(li); }
  }

  async function load() {
    if (busy) return; busy = true;
    try { const r = await (window.barunFetch || fetch)('/api/paths'); if (r.ok) render(await r.json()); }
    catch (e) { /* 토큰 창은 barunFetch가 띄움 */ } finally { busy = false; }
  }
  function start() { stop(); timer = setInterval(load, 60000); }
  function stop() { if (timer) clearInterval(timer); timer = 0; }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
