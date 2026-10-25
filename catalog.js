// 상품 화면 — 상품 대장 한 장(2026-10-25 사장님: "상품수가 갑자기 너무 늘어나면서 많은 것들이 뒤죽박죽 — 해소할 필요한 모든 조치").
// 실제 물건 하나 = 한 줄: 쿠팡·네이버 옵션·상태, 1개 원가, 구매처, 시트 탭, 주문, '정리할 것'. 누르면 옵션마다 자세히 + 고치기.
// 읽기: GET /api/catalog(dashboard/catalog.py) · 하나 GET /api/catalog/obj?id=P0001 — 화면이 보이는 동안 60초마다.
// 버튼: POST /api/action {action:'catalog', op, key} — 이름·맞아요·시트 이름·1개 원가·구매처·합치기·옵션 옮기기(대장·원가·구매처 표만, 쿠팡·네이버엔 안 씀).
// 자리: index.html의 #p-catalog를 채운다(보임·숨김은 'barun:page' 이벤트).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const ic = (name) => { const e = E('span', 'ct-i'); e.innerHTML = window.ico ? window.ico(name) : ''; return e; };
  const noE = (t) => (window.noEmoji ? window.noEmoji(t) : String(t ?? ''));
  const won = (n) => (n == null ? '' : `${Math.round(+n).toLocaleString('ko-KR')}원`);
  const when = (iso) => (iso ? String(iso).slice(5, 16).replace('T', ' ').replace('-', '/') : '');
  const PL = { coupang: '쿠팡', naver: '네이버' };
  const ST = { 승인완료: '판매중', SALE: '판매중', 부분승인완료: '판매중', SUSPENSION: '판매중지', PROHIBITION: '판매금지', OUTOFSTOCK: '품절',
    삭제됨: '삭제됨', 등록: '등록 직후', '옵션 판매중지': '옵션 판매중지' };
  const SELL = new Set(['승인완료', '부분승인완료', 'SALE']);
  const URGENT = new Set(['new', 'nocost_sold', 'noshop', 'shopgap', 'tabgap', 'costgap', 'dup', 'stuck', 'halt']);
  const ORIGIN = (o) => String(o || '').replace('같은 상품·', '같은 상품 ').replace('사장님 제공', '사장님').replace('주문 실측', '실측').replace('공홈 확인', '공홈');
  const PAGE = 60;
  let data = null, timer = 0, busy = false, shown = false, openId = null, lastFocus = null, limit = PAGE, seqN = 0, applied = 0, said = null;
  const flt = { q: '', p: '', plat: '', sort: 'orders' };
  try { Object.assign(flt, JSON.parse(localStorage.getItem('barun.catalogFlt') || '{}'), { q: '' }); } catch (e) { /* 무시 */ }
  const keep = () => { try { localStorage.setItem('barun.catalogFlt', JSON.stringify({ p: flt.p, plat: flt.plat, sort: flt.sort })); } catch (e) { /* 무시 */ } };

  function install() {
    const sec = $('p-catalog'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      .ct-i { display: inline-flex; vertical-align: -2px; } .ct-i svg { width: 15px; height: 15px; }
      .ct-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
      .ct-kpi { background: var(--card); border-radius: 14px; padding: 12px 14px; box-shadow: var(--shadow, none); }
      .ct-kpi .l { font-size: 12.5px; color: var(--sub); } .ct-kpi .v { font-size: 24px; font-weight: 750; margin-top: 2px; font-variant-numeric: tabular-nums; }
      .ct-kpi .s { font-size: 12px; color: var(--muted); margin-top: 2px; }
      .ct-kpi.warn .v { color: var(--orange-ink); }
      button.ct-kpi { border: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
      button.ct-kpi:hover { background: var(--hover); } button.ct-kpi:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
      button.ct-kpi[aria-pressed="true"] { box-shadow: inset 0 0 0 2px var(--blue); }
      .ct-tools { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 14px 0 10px; }
      .ct-q { flex: 1 1 220px; min-width: 0; max-width: 340px; box-sizing: border-box; height: 36px; border: 1px solid var(--line); border-radius: 18px; padding: 0 14px;
        background: var(--card); color: var(--ink); font: inherit; font-size: 14px; }
      .ct-q:focus { outline: 2px solid var(--blue); outline-offset: -1px; border-color: transparent; }
      .ct-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .ct-chip { all: unset; box-sizing: border-box; height: 32px; padding: 0 12px; border-radius: 16px; background: var(--fill); color: var(--ink2); font-size: 13px; cursor: pointer;
        display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
      .ct-chip:hover { background: var(--hover); } .ct-chip:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
      .ct-chip[aria-pressed="true"] { background: var(--blue); color: #fff; }
      .ct-chip .n { font-variant-numeric: tabular-nums; opacity: .75; }
      .ct-sel { box-sizing: border-box; height: 32px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: var(--ink); font: inherit; font-size: 13px; padding: 0 8px; }
      .ct-upd { font-size: 12px; color: var(--muted); margin-left: auto; white-space: nowrap; }
      .ct-desc { font-size: 13px; color: var(--sub); margin: -2px 0 10px; }
      .ct-list { background: var(--card); border-radius: 14px; overflow: hidden; }
      .ct-row { all: unset; box-sizing: border-box; width: 100%; cursor: pointer; display: grid; grid-template-columns: minmax(0, 2.6fr) minmax(0, 1.3fr) 110px minmax(0, 1fr) 72px 56px minmax(0, 1.4fr);
        gap: 10px; align-items: center; padding: 10px 14px; border-top: 1px solid var(--line); font-size: 13px; }
      .ct-row:first-child { border-top: 0; } .ct-row:hover { background: var(--hover); } .ct-row:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
      .ct-head { cursor: default; color: var(--muted); font-size: 12px; background: var(--fill2); } .ct-head:hover { background: var(--fill2); }
      .ct-nm { min-width: 0; } .ct-nm b { display: block; font-size: 14px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ct-nm span { display: block; font-size: 12px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ct-pl { display: flex; flex-wrap: wrap; gap: 4px; }
      .ct-pb { font-size: 12px; padding: 2px 7px; border-radius: 6px; background: var(--fill); color: var(--ink2); white-space: nowrap; }
      .ct-pb.off { color: var(--muted); text-decoration: line-through; } .ct-pb.wait { background: var(--orange-bg); color: var(--orange-ink); }
      .ct-cost { font-variant-numeric: tabular-nums; } .ct-cost small { display: block; font-size: 11.5px; color: var(--muted); }
      .ct-cost.no { color: var(--muted); }
      .ct-num { text-align: right; font-variant-numeric: tabular-nums; } .ct-cut { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
      .ct-tags { display: flex; flex-wrap: wrap; gap: 4px; }
      .ct-tag { font-size: 11.5px; padding: 2px 7px; border-radius: 6px; background: var(--orange-bg); color: var(--orange-ink); white-space: nowrap; }
      .ct-tag.soft { background: var(--fill); color: var(--sub); } .ct-tag.ok { background: var(--green-bg); color: var(--green-ink); }
      .ct-more { display: block; margin: 10px auto 0; }
      .ct-empty { padding: 28px 14px; text-align: center; color: var(--muted); font-size: 14px; }
      .ct-dr { position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 100vw); background: var(--card); box-shadow: var(--pop); z-index: 60; display: flex; flex-direction: column; }
      .ct-dr[hidden] { display: none; }
      .ct-dr-h { display: flex; align-items: flex-start; gap: 10px; padding: 16px 16px 12px; border-bottom: 1px solid var(--line); }
      .ct-dr-h h2 { margin: 0; font-size: 18px; flex: 1; min-width: 0; outline: none; word-break: break-all; }
      .ct-dr-h .sub { font-size: 13px; color: var(--sub); margin-top: 2px; font-weight: 400; }
      .ct-x { all: unset; flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: var(--sub); }
      .ct-x:hover { background: var(--hover); } .ct-x:focus-visible { outline: 2px solid var(--blue); }
      .ct-dr-b { overflow-y: auto; padding: 14px 16px 28px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-content: start; }
      .ct-dr h4 { margin: 0 0 6px; font-size: 13px; color: var(--sub); }
      .ct-fix { background: var(--orange-bg); color: var(--orange-ink); border-radius: 12px; padding: 10px 14px; font-size: 13.5px; line-height: 1.5; }
      .ct-fix ul { margin: 4px 0 0; padding-left: 18px; } .ct-fix li + li { margin-top: 4px; }
      .ct-good { background: var(--green-bg); color: var(--green-ink); border-radius: 12px; padding: 10px 14px; font-size: 13.5px; }
      .ct-kv { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 6px 10px; font-size: 13px; margin: 0; }
      .ct-kv dt { color: var(--muted); } .ct-kv dd { margin: 0; word-break: break-all; }
      .ct-form { display: grid; gap: 8px; }
      .ct-line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .ct-line > input, .ct-line > select { box-sizing: border-box; min-width: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: var(--ink); font: inherit; font-size: 13.5px;
        padding: 7px 9px; height: 36px; }
      .ct-line > input { flex: 1 1 160px; } .ct-line > input.s { flex: 0 1 110px; } .ct-line > select { flex: 0 0 auto; }
      .ct-line > input:focus, .ct-line > select:focus { outline: 2px solid var(--blue); outline-offset: -1px; border-color: transparent; }
      .ct-out { font-size: 12.5px; line-height: 1.5; padding: 8px 10px; border-radius: 8px; background: var(--fill); }
      .ct-out.ok { background: var(--green-bg); color: var(--green-ink); } .ct-out.bad { background: var(--red-bg); color: var(--red-ink); } .ct-out[hidden] { display: none; }
      .ct-opts { list-style: none; margin: 0; padding: 0; font-size: 13px; }
      .ct-opts li { border-top: 1px solid var(--line); padding: 8px 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; align-items: start; }
      .ct-opts li:first-child { border-top: 0; }
      .ct-opts .t { font-weight: 600; } .ct-opts .m { color: var(--muted); font-size: 12px; grid-column: 1 / -1; }
      .ct-opts .m a { color: var(--blue-ink); }
      .ct-opts .mv { grid-column: 1 / -1; }
      .ct-unit { font-size: 12px; color: var(--sub); margin: 10px 0 2px; font-weight: 650; }
      .ct-ev { list-style: none; margin: 0; padding: 0; font-size: 12.5px; }
      .ct-ev li { padding: 6px 0; border-top: 1px solid var(--line); display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: 8px; }
      .ct-ev li:first-child { border-top: 0; } .ct-ev .tm { color: var(--muted); font-variant-numeric: tabular-nums; }
      .ct-scrim { position: fixed; inset: 0; background: rgba(0, 0, 0, .25); z-index: 59; } .ct-scrim[hidden] { display: none; }
      @media (max-width: 1100px) {
        .ct-row { grid-template-columns: minmax(0, 2.4fr) minmax(0, 1.3fr) 100px minmax(0, 1fr) 56px minmax(0, 1.4fr); }
        .ct-row > .tb { display: none; }
      }
      @media (max-width: 760px) {
        .ct-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; } .ct-kpi { padding: 9px 10px; } .ct-kpi .v { font-size: 19px; }
        .ct-kpi .s { display: none; } .ct-kpi .l { font-size: 11.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        #ct-probs, #ct-plat { flex-wrap: nowrap; overflow-x: auto; max-width: 100%; padding-bottom: 2px; }
        #ct-probs .ct-chip, #ct-plat .ct-chip { flex: none; }
        .ct-head { display: none; }
        .ct-row { grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; }
        .ct-row > .ct-nm { grid-column: 1 / -1; } .ct-row > .ct-pl { grid-column: 1; } .ct-row > .ct-cost { grid-column: 2; grid-row: 2; text-align: right; }
        .ct-row > .sh, .ct-row > .tb, .ct-row > .o3 { display: none; } .ct-row > .ct-tags { grid-column: 1 / -1; }
        .ct-dr { width: 100vw; } .ct-q { max-width: none; flex-basis: 100%; }
      }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="ct-kpis" id="ct-kpis"></div>
      <div class="ct-tools">
        <input class="ct-q" id="ct-q" type="search" placeholder="상품·브랜드·번호(P0001·쿠팡·네이버 번호)" aria-label="상품 찾기">
        <span class="ct-chips" role="group" aria-label="플랫폼" id="ct-plat"></span>
        <select class="ct-sel" id="ct-sort" aria-label="정렬"><option value="orders">주문 많은 순</option><option value="fix">정리할 것 많은 순</option><option value="name">이름 순</option><option value="new">최근 생긴 순</option></select>
        <span class="ct-upd" id="ct-upd" aria-live="polite"></span>
      </div>
      <div class="ct-chips" role="group" aria-label="정리할 것" id="ct-probs"></div>
      <p class="ct-desc" id="ct-desc"></p>
      <div class="ct-list" id="ct-list" role="list"></div>
      <button class="btn ghost ct-more" type="button" id="ct-more" hidden>더 보기</button>
      <datalist id="ct-pids"></datalist><datalist id="ct-shops"></datalist>`;
    const dr = E('aside', 'ct-dr'); dr.id = 'ct-dr'; dr.hidden = true; dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-label', '상품 자세히');
    const scrim = E('div', 'ct-scrim'); scrim.id = 'ct-scrim'; scrim.hidden = true; scrim.onclick = () => closeDr();
    document.body.append(scrim, dr);
    $('ct-q').addEventListener('input', (e) => { flt.q = e.target.value.trim().toLowerCase(); limit = PAGE; render(); });
    $('ct-sort').value = flt.sort;
    $('ct-sort').onchange = (e) => { flt.sort = e.target.value; keep(); render(); };
    $('ct-more').onclick = () => { limit += PAGE * 2; render(); };
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('ct-dr').hidden) closeDr(); });
    document.addEventListener('barun:page', (e) => { shown = e.detail === 'catalog'; if (shown) { load(); start(); } else { stop(); closeDr(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (shown) { load(); start(); } });
    if (!sec.hidden) { shown = true; load(); start(); }
    return true;
  }
  function start() { stop(); timer = setInterval(load, 60000); }
  function stop() { clearInterval(timer); timer = 0; }

  async function load(fresh) {
    if (busy && !fresh) return; busy = true;
    const my = ++seqN;
    try {
      const r = await (window.barunFetch || fetch)('/api/catalog' + (fresh ? '?fresh=1' : ''));
      if (r.ok) { const j = await r.json(); if (my < applied) return; applied = my; data = j; render(); $('ct-upd').textContent = `${when(data.at)} 갱신`; }
    } catch (e) { /* 토큰 창은 barunFetch가 띄움 */ } finally { busy = false; }
  }
  async function act(body, btn, out) {
    const lab = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '저장 중…'; }
    try {
      const r = await (window.barunFetch || fetch)('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action: 'catalog' }, body)) });
      const j = await r.json().catch(() => ({ ok: false, msg: `응답을 읽지 못했어요(${r.status})` }));
      const msg = noE(String(j.msg || ''));
      if (window.toast) window.toast((j.ok ? '' : '실패: ') + msg.split('\n')[0].slice(0, 120));
      if (out) { out.hidden = false; out.className = 'ct-out ' + (j.ok ? 'ok' : 'bad'); out.textContent = msg; }
      if (j.ok) { said = msg; await load(true); if (openId) openDr(body.key || openId, null, true); }   // 다시 그린 서랍 맨 위에 결과 한 줄
      return j;
    } catch (e) { if (window.toast) window.toast('실패: ' + e.message); return null; } finally { if (btn) { btn.disabled = false; btn.textContent = lab; } }
  }

  // ── 목록 ──
  const platOk = (r) => {
    const c = (r.plats.coupang || {}).opts, n = (r.plats.naver || {}).opts;
    return !flt.plat || (flt.plat === 'coupang' ? c : flt.plat === 'naver' ? n : flt.plat === 'one' ? !(c && n) : (c && n));
  };
  const hay = (r) => [r.id, r.name, r.brand, r.spec, r.shop, r.tab, ...Object.keys(r.tabs || {}), ...(r.problems || []).map((p) => (data.labels || {})[p] || '')].join(' ').toLowerCase();
  function list() {
    let rows = data.products.filter((r) => (!flt.p || r.problems.includes(flt.p)) && platOk(r));
    if (flt.q) { const ws = flt.q.split(/\s+/); rows = rows.filter((r) => { const h = hay(r) + ' ' + (r._ids || ''); return ws.every((w) => h.includes(w)); }); }
    const urg = (r) => r.problems.filter((p) => URGENT.has(p)).length;
    if (flt.sort === 'fix') rows = rows.slice().sort((a, b) => urg(b) - urg(a) || b.orders - a.orders);
    else if (flt.sort === 'name') rows = rows.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    else if (flt.sort === 'new') rows = rows.slice().sort((a, b) => b.id.localeCompare(a.id));
    return rows;
  }
  function plBadges(r) {
    const box = E('span', 'ct-pl');
    for (const pl of ['coupang', 'naver']) {
      const d = r.plats[pl]; if (!d) continue;
      const wait = Object.keys(d.status).some((s) => /심사|임시|반려|대기/.test(s)), off = !d.selling;
      const b = E('span', 'ct-pb' + (off ? (wait ? ' wait' : ' off') : ''), `${PL[pl]} ${d.selling || d.opts}${d.units > 1 ? ` · 상품 ${d.units}` : ''}`);
      b.title = Object.entries(d.status).map(([s, n]) => `${ST[s] || s} ${n}`).join(' · ');
      box.append(b);
    }
    return box;
  }
  function costCell(r) {
    const c = E('span', 'ct-cost' + (r.cost ? '' : ' no'));
    if (!r.cost) { c.textContent = '원가 모름'; return c; }
    c.append(document.createTextNode(won(r.cost.unit)), E('small', null, `1개 · ${ORIGIN(r.cost.origin)}${r.cost.est ? ' · 추정' : ''}`));
    return c;
  }
  function tags(r) {
    const box = E('span', 'ct-tags');
    const ps = r.problems.slice().sort((a, b) => (URGENT.has(b) ? 1 : 0) - (URGENT.has(a) ? 1 : 0));
    for (const p of ps.slice(0, 3)) box.append(E('span', 'ct-tag' + (URGENT.has(p) ? '' : ' soft'), (data.labels || {})[p] || p));
    if (ps.length > 3) box.append(E('span', 'ct-tag soft', `+${ps.length - 3}`));
    if (!ps.length && r.state === '확인') box.append(E('span', 'ct-tag ok', '확인함'));
    return box;
  }
  function render() {
    if (!data) return;
    if (data.empty) { $('ct-list').innerHTML = '<div class="ct-empty">상품 대장이 아직 없어요 — python -m pricing.catalog 만들기</div>'; return; }
    data.labels = Object.fromEntries(data.problems.map((p) => [p.code, p.label]));
    const k = data.kpi, pc = Object.fromEntries(data.problems.map((p) => [p.code, p.n]));
    const kp = $('ct-kpis'); kp.textContent = '';
    const tile = (l, v, s, warn, code) => {
      const t = E(code ? 'button' : 'div', 'ct-kpi' + (warn ? ' warn' : '')); if (code) { t.type = 'button'; t.setAttribute('aria-pressed', String(flt.p === code)); t.onclick = () => { flt.p = flt.p === code ? '' : code; keep(); limit = PAGE; render(); }; }
      t.append(E('div', 'l', l), E('div', 'v', v), E('div', 's', s)); kp.append(t);
    };
    tile('상품(실제 물건)', k.products.toLocaleString(), `판매 옵션 ${k.options.toLocaleString()}개를 묶음`);
    tile('판매 중', k.selling.toLocaleString(), `쿠팡 ${k.coupang} · 네이버 ${k.naver} · 둘 다 ${k.both}`);
    tile('정리할 것', k.fix.toLocaleString(), '아래 칩으로 골라 보기', k.fix > 0);
    tile('원가 모름(팔림)', (pc.nocost_sold || 0).toLocaleString(), `안 팔린 것 ${pc.nocost || 0}개`, (pc.nocost_sold || 0) > 0, 'nocost_sold');
    tile('판매 전 오래', (pc.stuck || 0).toLocaleString(), `쿠팡 임시저장·심사·반려`, (pc.stuck || 0) > 0, 'stuck');
    const pb = $('ct-probs'); pb.textContent = '';
    const chip = (code, label, n) => {
      const b = E('button', 'ct-chip'); b.type = 'button'; b.setAttribute('aria-pressed', String(flt.p === code)); b.append(document.createTextNode(label));
      if (n != null) b.append(E('span', 'n', n)); b.onclick = () => { flt.p = flt.p === code ? '' : code; keep(); limit = PAGE; render(); }; pb.append(b);
    };
    chip('', '전체', null);
    for (const p of data.problems) if (p.n) chip(p.code, p.label, p.n);
    const pl = $('ct-plat'); pl.textContent = '';
    for (const [v, t] of [['', '모든 플랫폼'], ['coupang', '쿠팡'], ['naver', '네이버'], ['both', '둘 다'], ['one', '한쪽만']]) {
      const b = E('button', 'ct-chip', t); b.type = 'button'; b.setAttribute('aria-pressed', String(flt.plat === v));
      b.onclick = () => { flt.plat = v; keep(); limit = PAGE; render(); }; pl.append(b);
    }
    const cur = data.problems.find((p) => p.code === flt.p);
    $('ct-desc').textContent = cur ? cur.desc : '같은 물건은 쿠팡·네이버·수량이 달라도 한 줄이에요. 줄을 누르면 옵션마다 원가·구매처·상태를 보고 바로 고칠 수 있어요.';
    const rows = list();
    const box = $('ct-list'); box.textContent = '';
    const head = E('div', 'ct-row ct-head');
    for (const [t, cls] of [['상품', ''], ['파는 곳', ''], ['1개 원가', ''], ['구매처', 'sh'], ['시트 탭', 'tb'], ['30일', 'o3 ct-num'], ['정리할 것', '']]) head.append(E('span', cls, t));
    box.append(head);
    for (const r of rows.slice(0, limit)) {
      const b = E('button', 'ct-row'); b.type = 'button'; b.dataset.id = r.id; b.setAttribute('role', 'listitem');
      const nm = E('span', 'ct-nm'); nm.append(E('b', null, r.name), E('span', null, [r.brand, r.spec, r.id].filter(Boolean).join(' · ')));
      b.append(nm, plBadges(r), costCell(r), E('span', 'ct-cut sh', r.shop || '—'), E('span', 'ct-cut tb', r.tab || '—'), E('span', 'ct-num o3', r.o30 || ''), tags(r));
      b.onclick = () => openDr(r.id, b);
      box.append(b);
    }
    if (!rows.length) box.append(E('div', 'ct-empty', flt.q || flt.p || flt.plat ? '맞는 상품이 없어요' : '상품이 없어요'));
    $('ct-more').hidden = rows.length <= limit;
    $('ct-more').textContent = `더 보기(${(rows.length - limit).toLocaleString()}개 더)`;
    const dl = $('ct-pids'); if (!dl.childElementCount || dl.dataset.n !== String(data.products.length)) {
      dl.textContent = ''; dl.dataset.n = String(data.products.length);
      for (const r of data.products) { const o = E('option'); o.value = r.id; o.label = r.name; dl.append(o); }
      const ds = $('ct-shops'); ds.textContent = '';
      for (const s of [...new Set(data.products.map((r) => r.shop).filter(Boolean))].sort()) { const o = E('option'); o.value = s; ds.append(o); }
    }
  }

  // ── 자세히(서랍) ──
  function closeDr() {
    const d = $('ct-dr'); if (!d || d.hidden) return;
    d.hidden = true; $('ct-scrim').hidden = true; openId = null;
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    else if (lastFocus) { const again = document.querySelector(`.ct-row[data-id="${CSS.escape(lastFocus.dataset.id || '')}"]`); if (again) again.focus({ preventScroll: true }); }
  }
  async function openDr(id, from, again) {
    if (!again) lastFocus = from || document.activeElement;
    openId = id;
    const d = $('ct-dr'); d.hidden = false; $('ct-scrim').hidden = false;
    if (!again) { d.textContent = ''; d.append(E('div', 'ct-empty', '읽는 중…')); }
    try {
      const r = await (window.barunFetch || fetch)(`/api/catalog/obj?id=${encodeURIComponent(id)}`);
      if (!r.ok || openId !== id) return;
      const j = await r.json();
      if (j.error) { d.textContent = ''; d.append(E('div', 'ct-empty', j.error)); return; }
      draw(d, j, again);
    } catch (e) { d.textContent = ''; d.append(E('div', 'ct-empty', '읽기 실패 · 다시 눌러 주세요')); }
  }
  function form(title, fields, btnLabel, onSave, hint) {
    const f = E('div', 'ct-form'); f.append(E('h4', null, title));
    const line = E('div', 'ct-line'); for (const x of fields) line.append(x);
    const b = E('button', 'btn sm', btnLabel); b.type = 'button'; line.append(b);
    const out = E('div', 'ct-out'); out.hidden = true;
    b.onclick = () => onSave(b, out);
    for (const x of fields) if (x.tagName === 'INPUT') x.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); b.click(); } });
    f.append(line); if (hint) f.append(E('div', 'ct-desc', hint)); f.append(out);
    return f;
  }
  const inp = (val, ph, cls, list) => { const i = E('input', cls || ''); i.value = val || ''; i.placeholder = ph || ''; if (list) i.setAttribute('list', list); i.setAttribute('aria-label', ph || ''); return i; };
  function fixList(j) {
    const L = j.problem_labels || {}; const lines = [];
    const units = (pl, us) => us.map((u) => `${PL[pl] || pl} ${u}`).join(' · ');
    for (const p of j.problems) {
      if (p === 'new') lines.push('처음 본 물건이에요 — 다른 상품과 같은 물건이면 아래 [합치기], 아니면 [맞아요]');
      else if (p === 'nocost_sold' || p === 'nocost') lines.push(`${L[p]} — 아래 '1개 원가'에 적으면 옵션마다 수량만큼 써요`);
      else if (p === 'noshop') lines.push('구매처 모름 — 아래 \'구매처\'에서 정하면 쿠팡·네이버 상품 모두에 적어요');
      else if (p === 'shopgap') lines.push(`구매처 엇갈림 — ${Object.entries(j.shops).map(([s, n]) => `${s} ${n}`).join(' · ')} → 하나로 정해 주세요`);
      else if (p === 'tabgap') lines.push(`시트 탭 엇갈림 — ${Object.entries(j.tabs).map(([t, n]) => `${t} ${n}줄`).join(' · ')} → 주문 데이터 화면에서 줄을 한 탭으로 옮기면 다음부터 그 탭으로 들어가요`);
      else if (p === 'costgap') lines.push('원가 엇갈림 — 아래 옵션별 원가를 보고, 묶음이 틀렸으면 옵션을 옮기고 원가가 옛값이면 새 1개 원가를 적어 주세요');
      else if (p === 'dup') for (const x of j.dup) lines.push(`같은 플랫폼 중복 — ${PL[x.platform]} ${(x.qtys || [x.qty]).join('·')}개 옵션이 ${units(x.platform, x.units)}에 둘 다 판매 중 → 매일 자동 정리가 주문 적은 쪽(차이가 작으면 나중에 올린 쪽)을 판매중지해요(사전 지시). 묶음이 틀렸으면 옵션을 옮겨 주세요`);
      else if (p === 'stuck') for (const x of j.stuck) lines.push(`쿠팡 ${x.unit} ${x.status}${x.days != null ? ` ${x.days}일째` : ''}${x.note ? ` — ${x.note}` : ''}`);
      else if (p === 'halt') for (const x of j.halt) lines.push(`네이버 ${x.unit} ${x.status}`);
      else if (p === 'nvsplit') lines.push('네이버에 수량마다 따로 올라가 있어요 → 매일 자동 정리가 그룹상품으로 묶어요(사전 지시 — 상품번호·리뷰·가격 그대로, 이름은 그룹명+옵션)');
    }
    return lines;
  }
  function draw(d, j, again) {
    const top = again ? d.querySelector('.ct-dr-b')?.scrollTop || 0 : 0;
    d.textContent = '';
    const head = E('div', 'ct-dr-h'); const h = E('h2', null, j.name); h.tabIndex = -1;
    h.append(E('div', 'sub', [j.brand, j.spec, j.id, j.state === '확인' ? '확인함' : j.state === '새 상품' ? '새 상품(확인 필요)' : '이름으로 묶음'].filter(Boolean).join(' · ')));
    const x = E('button', 'ct-x'); x.append(ic('x')); x.type = 'button'; x.setAttribute('aria-label', '닫기'); x.onclick = closeDr;
    head.append(h, x);
    const body = E('div', 'ct-dr-b');
    if (said) { const o = E('div', 'ct-out ok'); o.setAttribute('role', 'status'); o.append(ic('check'), document.createTextNode(' ' + said)); body.append(o); said = null; }
    const fx = fixList(j);
    if (fx.length) { const f = E('div', 'ct-fix'); f.append(E('b', null, `정리할 것 ${fx.length}`)); const ul = E('ul'); for (const t of fx) ul.append(E('li', null, t)); f.append(ul); body.append(f); }
    else body.append(E('div', 'ct-good', '정리할 것 없음'));
    const kv = E('dl', 'ct-kv');
    const row = (k, v) => { kv.append(E('dt', null, k), E('dd', null, v)); };
    row('1개 원가', j.cost ? `${won(j.cost.unit)} · ${ORIGIN(j.cost.origin)}${j.cost.est ? ' · 추정' : ''}` : '모름');
    const r2 = (v) => Math.round(+v * 100) / 100;
    if (j.source) row('원천', `${j.source.title || j.source.source_key}${j.source.unit_price ? ` · 공홈 ${r2(j.source.unit_price)} ${j.source.currency || ''}` : ''}${j.source.user_price ? ` · 사장님 ${r2(j.source.user_price)} ${j.source.user_currency || ''}` : ''}`);
    row('구매처', j.shop ? Object.entries(j.shops).map(([s, n]) => `${s}${Object.keys(j.shops).length > 1 ? ` ${n}` : ''}`).join(' · ') : '모름');
    row('시트 탭', Object.keys(j.tabs).length ? Object.entries(j.tabs).map(([t, n]) => `${t}${n ? ` ${n}줄` : ''}`).join(' · ') : '아직 없음');
    row('주문', `${j.orders}건${j.o30 ? ` · 30일 ${j.o30}건` : ''}${j.last ? ` · 마지막 ${when(j.last)}` : ''}`);
    row('시트 이름', j.sheet ? '대표 이름으로' : '판매 이름 그대로');
    body.append(kv);
    // 고치기
    const nameIn = inp(j.name, '대표 이름');
    body.append(form('이름', [nameIn], '이름 저장', (b, out) => act({ op: 'rename', key: j.id, name: nameIn.value }, b, out)));
    const acts = E('div', 'ct-line');
    const ok = E('button', 'btn sm ghost'); ok.type = 'button'; ok.append(ic('check'), document.createTextNode(j.state === '확인' ? ' 확인함' : ' 맞아요(같은 물건 맞음)'));
    ok.disabled = j.state === '확인'; ok.onclick = () => act({ op: 'confirm', key: j.id }, ok);
    const sh = E('button', 'btn sm ghost'); sh.type = 'button'; sh.setAttribute('aria-pressed', String(!!j.sheet));
    sh.textContent = j.sheet ? '시트 이름 되돌리기' : '시트에도 이 이름으로';
    sh.title = '켜면 시트 새 줄에 대표 이름·\'N개 규격\' 옵션으로 들어가요(이미 있는 줄·재고 줄은 그대로)';
    sh.onclick = () => act({ op: 'sheet', key: j.id, on: !j.sheet }, sh);
    acts.append(ok, sh, assignBtn(j));
    body.append(acts);
    const price = inp('', '1개 원가', 's'); price.inputMode = 'decimal';
    const cur = E('select'); for (const c of ['USD', 'EUR', 'GBP', 'AUD', 'JPY', 'KRW']) { const o = E('option', null, c); o.value = c; cur.append(o); }
    if (j.source && j.source.user_currency) cur.value = j.source.user_currency;
    cur.setAttribute('aria-label', '통화');
    body.append(form('1개 원가(사장님이 아는 값)', [price, cur], '원가 저장', (b, out) => act({ op: 'cost', key: j.id, price: price.value, currency: cur.value, shop: j.shop }, b, out),
      '1개(1병·1통) 값이에요. 옵션마다 수량만큼 곱해 수익·추천가에 써요.'));
    const shop = inp(j.shop, '예: chewy.com · 사장님직접', '', 'ct-shops');
    body.append(form('구매처', [shop], '구매처 저장', (b, out) => act({ op: 'shop', key: j.id, shop: shop.value }, b, out), '이 물건의 쿠팡·네이버 상품 모두에 적어요(주문이 오면 그 구매처로).'));
    const mg = inp('', '합칠 상품 번호(P0123)', '', 'ct-pids');
    body.append(form('같은 물건 합치기', [mg], '합치기', (b, out) => { if (!mg.value.trim()) return; if (!confirm(`${mg.value.trim()}을(를) 이 상품으로 합칠까요?`)) return; act({ op: 'merge', key: j.id, with: mg.value }, b, out); },
      '다른 줄에 같은 물건이 있으면 번호를 적어 이 줄로 모아요.'));
    // 옵션
    const ob = E('div'); ob.append(E('h4', null, `판매 옵션 ${j.options.length}개`));
    let lastUnit = '';
    const ul = E('ul', 'ct-opts');
    for (const o of j.options) {
      const u = `${o.platform}:${o.unit}`;
      if (u !== lastUnit) { lastUnit = u; const t = E('li'); t.style.cssText = 'border-top:0;padding:0'; t.append(E('div', 'ct-unit', `${PL[o.platform]} ${o.platform === 'coupang' ? '등록상품' : '상품'} ${o.unit}${o.group && o.platform === 'naver' ? ` · 그룹 ${o.group}` : ''}`)); ul.append(t); }
      const li = E('li');
      const t = E('span', 't', `${o.opt || o.name}`);
      const right = E('span', null, `${o.qty ? `${o.qty}개 · ` : '수량 옵션마다 · '}${won(o.price)}`);
      const m = E('span', 'm');
      m.append(document.createTextNode([ST[o.status] || o.status, o.cost ? `원가 ${won(o.cost.krw)}(${ORIGIN(o.cost.origin)}${o.cost.est ? ' · 추정' : ''})` : '원가 모름',
        o.how ? `묶은 근거: ${o.how}` : '', o.tab ? `탭 ${o.tab}` : ''].filter(Boolean).join(' · ') + ' '));
      if (o.url) { const a = E('a', null, '판매 화면'); a.href = o.url; a.target = '_blank'; a.rel = 'noopener'; m.append(a); }
      const mvb = E('button', 'btn sm weak', '옮기기'); mvb.type = 'button'; mvb.style.marginLeft = '6px';
      m.append(mvb);
      li.append(t, right, m);
      mvb.onclick = () => {
        if (li.querySelector('.mv')) { li.querySelector('.mv').remove(); return; }
        const to = inp('', '옮길 상품(P0123) · 비우면 새 상품', '', 'ct-pids'); const q = inp(o.qty || '', '수량', 's'); q.inputMode = 'numeric';
        const f = form('이 옵션을 다른 상품으로', [to, q], '옮기기', (b, out) => act({ op: 'move', key: j.id, platform: o.platform, listing_id: o.listing_id, to: to.value.trim() || '새', qty: q.value }, b, out),
          '틀리게 묶인 옵션을 맞는 상품으로(수량도 고칠 수 있어요).');
        f.classList.add('mv'); li.append(f); to.focus();
      };
      ul.append(li);
    }
    ob.append(ul); body.append(ob);
    if (j.history.length) {
      const hb = E('div'); hb.append(E('h4', null, '플랫폼 상태 이력'));
      const ev = E('ul', 'ct-ev');
      for (const x of j.history) { const li = E('li'); li.append(E('span', 'tm', when(x.at)), E('span', null, `${PL[x.platform]} ${x.unit} ${ST[x.status] || x.status}${x.note ? ` — ${x.note}` : ''}`)); ev.append(li); }
      hb.append(ev); body.append(hb);
    }
    if (j.recent.length) {
      const rb = E('div'); rb.append(E('h4', null, '최근 주문'));
      const ev = E('ul', 'ct-ev');
      for (const o of j.recent) { const li = E('li'); li.append(E('span', 'tm', when(o.ordered_at)), E('span', null, `${PL[o.platform]} ${o.option || ''} · ${o.status || ''}`)); ev.append(li); }
      rb.append(ev); body.append(rb);
    }
    if (j.log.length) {
      const lb = E('div'); lb.append(E('h4', null, '고친 기록'));
      const ev = E('ul', 'ct-ev');
      for (const x of j.log) { const li = E('li'); li.append(E('span', 'tm', when(x.at)), E('span', null, `${x.action} · ${x.by}`)); ev.append(li); }
      lb.append(ev); body.append(lb);
    }
    d.append(head, body);
    if (again) body.scrollTop = top; else h.focus({ preventScroll: true });
  }
  function assignBtn(j) {
    const b = E('button', 'btn sm ghost'); b.type = 'button'; b.append(ic('bot'), document.createTextNode(' 에이전트에게 맡기기'));
    b.onclick = () => {
      if (!window.openAsk) return;
      window.openAsk();
      const t = document.getElementById('task-text'); if (!t) return;
      const fx = fixList(j);
      t.value = noE(`상품 ${j.id} '${j.name}'(쿠팡 ${(j.plats.coupang || {}).opts || 0}옵션 · 네이버 ${(j.plats.naver || {}).opts || 0}옵션)${fx.length ? ` — ${fx.join(' / ')}` : ''}\n할 일: `);
      setTimeout(() => { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }, 40);
    };
    return b;
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
})();
