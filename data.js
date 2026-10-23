// 🗂 주문 데이터 화면 — barun.db 표 찾아보기 + 바로 조치(2026-10-21 사장님: "디비도 현황판에서 접근하고 어떤 액션이든 바로",
//   "더이상 구글 스프레드시트를 사용하지 않을 수 있을 정도의 기능").
// 읽기: GET /api/db/tables · /api/db/rows?table=&q=&preset=&f=<필터 JSON>&sort=칸:asc,칸:desc&offset= · /api/db/values?col=&find= · /api/db/history?key=
//   (dashboard/dbview.py, 읽기 전용 — 정렬·필터·맞물린 개수는 서버에서, 주문 시트는 DB 원본이면 격자의 지금 값)
// 조치: POST /api/action {action:"db", kind, ...} → notify/actions.py → 주문 시트는 ops/orderedit.py(줄·먼저 고친 사람·회차 확인, 누른 사람 이름으로 일지)
// 주문 시트: 칸을 눌러 고치기(여러 칸 모아 한 번에 저장) · 줄 여러 개 골라 같은 값 넣기 · 할 일 묶음 · 줄 나누기·옮기기·지우기·문제 표시 · 재고 줄 추가
//   2026-10-23: 격자의 모든 열·열 숨김/고정 · 시트 색·칸 메모·선택 목록(grid_meta) · 여러 칸 붙여넣기·아래로 채우기(미리보기) · 바꾼 기록·되돌리기(/api/db/audit, sheet_undo)
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const fetchJ = async (p, opts) => (await (window.barunFetch || fetch)(p, opts)).json();
  const won = (v) => (+v).toLocaleString('ko-KR') + '원';
  const COLNAME = { lead_id: '줄', title: '상품', quantity: '수량', state: '상태', profit: '이익', cost_krw: '도착원가', market_krw: '시장가', plan: '계획가',
    marks: '표시', reason: '판정 이유', waiting: '대기', updated: '고친 시각', source_key: '원천', country: '나라', site: '판매처', currency: '통화', unit_price: '단가', fx_krw: '환율',
    checked_at: '확인', status: '상태', notes: '메모', platform: '플랫폼', listing_id: 'id', name: '상품명', qty: '수량', price: '가격', seller_code: '판매자 코드',
    group_no: '그룹·상품', at: '시각', action: '동작', applied: '실행', ok: '성공', summary: '요약', approved_by: '승인', tab: '탭', row: '행', receiver: '받는 분',
    option: '옵션', progress: '진행상태', intl_tracking: '해외송장', kr_invoice: '국내송장', fwd_request: '배대지 신청번호', memo: '메모', problem: '문제', key: 'key',
    ordered_at: '주문일', claim_status: '클레임', paid: '결제', courier: '택배사', invoice: '송장', src: '출처', field: '칸', old: '전', new: '후',
    ordered: '주문일시', shop: '구매처', shop_price: '공홈가', shop_order: '공홈주문번호', ship_mode: '배송방식', intl_carrier: '해외운송사', fwd_center: '배대지센터',
    ship_cost: '배송비', margin: '수익률', send_qty: '보낼수량', order_no: '주문번호', due: '발송기한', settle: '정산', cost: '원가', stock_note: '재고안내', point: '포인트',
    tax_rate: '세율', handling: '처리 방식', ref: '근거', claim: '클레임', claim_at: '클레임 시각', order_id: '주문번호', line_id: '줄 id', product_id: '상품 id',
    tel: '연락처', zip: '우편번호', addr: '주소', ship_memo: '배송메모', pccc: '통관부호', stock_note: '재고안내' };
  const STATES = ['후보', '정밀확인', '탈락', '외부대기', '끝'];
  // 보기 상태 = 표·찾기·할 일 묶음·열 필터·정렬·페이지·숨긴 열·고정 열 — 주소(#data?…)에 남아 새로고침·공유해도 그대로, '보기 저장'은 이 브라우저(localStorage)에
  const DEF = (t) => ({ table: t, q: '', preset: t === 'sheet_rows' ? '진행 중' : t === 'order_ledger' ? '미정' : '', offset: 0, filters: [], sort: [], hide: [],
    pin: t === 'sheet_rows' ? ['tab', 'row', 'receiver'] : [] });   // 주문 시트는 탭·행·받는 분을 왼쪽에 고정(오른쪽으로 넘겨도 누구 줄인지 보이게, 10/23 사장님 "285mm 뒤 정보를 볼 수 없어")
  // 바꾼 기록에서 되돌릴 수 있는 일(ops/orderedit.undo와 같게)
  const UNDO_OPS = ['칸', '일괄', '붙여넣기', '채우기', '되돌리기', '설정', '메모', '색', '지우기'];
  let cur = DEF('sheet_rows'), last = null, sel = null, built = false;
  let pending = {}, picked = new Set();          // 주문 시트: 아직 저장 안 한 칸 {tab:row:col → edit}, 고른 줄 {tab:row}
  const isSheet = () => cur.table === 'sheet_rows';
  const rid = (r) => `${r.tab}:${r.row}`;

  const fmt = (k, v) => {
    if (v == null || v === '') return '';
    if (['profit', 'cost_krw', 'market_krw', 'price', 'paid', 'settle'].includes(k) && !isNaN(+v) && String(v).trim() !== '') return won(v);
    if (typeof v === 'string' && (v.startsWith('[') || v.startsWith('{'))) { try { const j = JSON.parse(v); return Array.isArray(j) ? j.join(', ') : Object.entries(j).map(([a, b]) => `${a === 'naver' ? '네이버' : a === 'coupang' ? '쿠팡' : a} ${typeof b === 'number' ? b.toLocaleString('ko-KR') : (typeof b === 'object' ? JSON.stringify(b) : b)}`).join(' · '); } catch (e) { /* 그대로 */ } }
    if (/^\d{4}-\d\d-\d\dT/.test(String(v))) return String(v).slice(5, 16).replace('T', ' ');
    return String(v);
  };
  const badgeCls = (v) => /탈락|반려|실패|SUSPENSION|PROHIBITION|CANCEL|취소|반품|미정/.test(v) ? 'bad' : /정밀확인|등록준비|대기|심사|OUTOFSTOCK|요청중|필요/.test(v) ? 'warn' : /등록|승인완료|SALE|ok|끝|발송완료|해외구매|재고발송/.test(v) ? 'ok' : '';

  function build() {
    const root = $('p-data'); if (!root || built) return; built = true;
    root.innerHTML = '';
    const card = E('div', 'card');
    const h = E('div', 'card-h'); h.append(E('h2', null, '데이터'), E('span', 'desc', '전용 장부(barun.db)예요. 주문 시트는 칸을 눌러 바로 고치고, 줄을 누르면 자세히 보고 조치할 수 있어요 — 바꾸는 일은 누른 사람 이름으로 일지에 남아요.'));
    card.append(h, E('div', 'dt-tables', null), E('div', 'dt-tools', null), E('div', 'dt-presets', null), E('div', 'dt-facets', null), E('div', 'dt-stock', null),
      E('div', 'dt-wrap', null), E('div', 'dt-more', null));
    root.append(card, Object.assign(E('div', 'dt-bar'), { id: 'dt-bar', hidden: true }), Object.assign(E('div', 'card dt-detail'), { id: 'dt-detail', hidden: true }));
    const tools = card.querySelector('.dt-tools');
    const q = E('input', 'dt-q'); q.type = 'search'; q.placeholder = '찾기 — 받는 분·상품·주문번호·송장·공홈주문번호'; q.setAttribute('aria-label', '찾기');
    let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { cur.q = q.value.trim(); cur.offset = 0; load(); }, 300); };
    const ab = E('button', 'btn sm ghost dt-audit-btn', '바꾼 기록·되돌리기'); ab.type = 'button'; ab.onclick = () => auditPanel();
    tools.append(q, ab);
    const fp = E('details', 'dt-fpanel'); fp.id = 'dt-fpanel';
    const au = E('div', 'dt-form dt-audit'); au.hidden = true;
    tools.after(fp, au);
  }

  // ── 주소(#data?…)·저장한 보기 ──
  function saveHash() {
    const s = { t: cur.table, p: cur.preset };
    if (cur.q) s.q = cur.q; if (cur.offset) s.o = cur.offset; if (cur.filters.length) s.f = cur.filters; if (cur.sort.length) s.s = cur.sort;
    if (cur.hide.length) s.h = cur.hide; if (cur.pin.join() !== DEF(cur.table).pin.join()) s.pin = cur.pin;
    const h = '#data?' + encodeURIComponent(JSON.stringify(s));
    if (location.hash !== h) history.replaceState(null, '', h);
  }
  function fromState(s) {
    if (!s || typeof s.t !== 'string') return false;
    const d = DEF(s.t);
    cur = Object.assign(d, { q: typeof s.q === 'string' ? s.q : '', preset: typeof s.p === 'string' ? s.p : d.preset, offset: Math.max(0, +s.o || 0),
      filters: Array.isArray(s.f) ? s.f.filter((f) => f && typeof f.c === 'string' && typeof f.op === 'string' && (f.op !== 'in' || Array.isArray(f.vs))) : [],
      sort: Array.isArray(s.s) ? s.s.filter((x) => typeof x === 'string') : [],
      hide: Array.isArray(s.h) ? s.h.filter((x) => typeof x === 'string') : [], pin: Array.isArray(s.pin) ? s.pin.filter((x) => typeof x === 'string') : d.pin });
    const qi = document.querySelector('.dt-q'); if (qi) qi.value = cur.q;
    return true;
  }
  function readHash() {
    const m = location.hash.match(/^#data\?(.+)$/); if (!m) return false;
    try { return fromState(JSON.parse(decodeURIComponent(m[1]))); } catch (e) { return false; }
  }
  const VIEWS = 'barun.dataViews';
  const views = () => { try { return JSON.parse(localStorage.getItem(VIEWS) || '{}') || {}; } catch (e) { return {}; } };
  const putViews = (v) => { try { localStorage.setItem(VIEWS, JSON.stringify(v)); return true; } catch (e) { return false; } };

  // ── 필터·정렬 도우미 ──
  const isNum = (c) => ((last && last.numeric) || []).includes(c);
  const isDate = (c) => ((last && last.dates) || []).includes(c);
  const cname = (c) => COLNAME[c] || (last && last.heads && last.heads[c]) || c;
  // 화면에 그릴 칸 = 숨긴 칸 빼고, 고정한 칸을 앞으로(시트 열 구조는 그대로 — 보기만)
  const visCols = () => { const cs = last.cols.filter((c) => !cur.hide.includes(c)); const p = cur.pin.filter((c) => cs.includes(c)); return [...p, ...cs.filter((c) => !p.includes(c))]; };
  const blankName = (c, v) => (v == null || v === '' ? (c === 'platform' ? '재고·수동(빈칸)' : '(빈칸)') : String(v));
  function setFilter(c, f) { cur.filters = cur.filters.filter((x) => x.c !== c); if (f) cur.filters.push(f); cur.offset = 0; }
  function toggleVal(c, v) {        // 칩: 같은 칸에서 여러 값 고르기(누르면 넣고, 다시 누르면 뺌)
    const f = cur.filters.find((x) => x.c === c && x.op === 'in');
    const vs = f ? f.vs.slice() : [];
    const i = vs.indexOf(v); if (i >= 0) vs.splice(i, 1); else vs.push(v);
    setFilter(c, vs.length ? { c, op: 'in', vs } : null);
  }
  function pickVal(c, v, multi) {   // 칩 누르기 = 그것만(독일 고른 채 프랑스 누르면 독일 풀림, 10/23 사장님) · 다시 누르면 전체 · ⌘/Ctrl/Shift+클릭 = 여러 개
    if (multi) return toggleVal(c, v);
    const f = cur.filters.find((x) => x.c === c && x.op === 'in');
    setFilter(c, f && f.vs.length === 1 && f.vs[0] === v ? null : { c, op: 'in', vs: [v] });
  }
  function fdesc(f) {
    const n = cname(f.c);
    if (f.op === 'has') return `${n}에 '${f.v || ''}' 들어감`;
    if (f.op === 'eq') return `${n} = '${f.v || '빈칸'}'`;
    if (f.op === 'in') return `${n}: ${f.vs.slice(0, 3).map((v) => blankName(f.c, v)).join(', ')}${f.vs.length > 3 ? ` 외 ${f.vs.length - 3}개` : ''}`;
    if (f.op === 'blank') return `${n} 빈칸`;
    if (f.op === 'notblank') return `${n} 빈칸 아님`;
    if (f.op === 'range') return `${n} ${f.lo || '처음'} ~ ${f.hi || '끝'}`;
    return n;
  }
  const sortOf = (c) => { const i = cur.sort.findIndex((s) => s.split(':')[0] === c); return i < 0 ? null : { i, d: cur.sort[i].split(':')[1] === 'desc' ? 'desc' : 'asc' }; };
  function clickSort(c, multi) {      // 오름 → 내림 → 해제, Shift+클릭은 여러 열
    const now = sortOf(c), next = !now ? 'asc' : now.d === 'asc' ? 'desc' : null;
    if (multi) { if (now) cur.sort.splice(now.i, 1, ...(next ? [`${c}:${next}`] : [])); else cur.sort.push(`${c}:asc`); }
    else cur.sort = next ? [`${c}:${next}`] : [];
    cur.offset = 0; load();
  }
  function params() {
    const ps = new URLSearchParams({ table: cur.table, q: cur.q, preset: cur.preset || '' });
    if (cur.filters.length) ps.set('f', JSON.stringify(cur.filters));
    return ps;
  }

  // ── 필터·정렬 패널(접이식 — 휴대폰에서도) ──
  let fcol = '';
  function panel() {
    const p = $('dt-fpanel'); if (!p || !last) return;
    const open = p.open; p.textContent = '';
    const n = cur.filters.length + cur.sort.length;
    const sm = E('summary', null, n ? `필터·정렬 (${n})` : '필터·정렬·저장한 보기'); p.append(sm); p.open = open;
    const body = E('div', 'dt-fp');
    // 걸린 것
    const on = E('div', 'dt-pills');
    for (const f of cur.filters) {
      const b = E('button', 'chipbtn on', fdesc(f) + ' ✕'); b.type = 'button'; b.title = '이 필터 풀기';
      b.onclick = () => { cur.filters = cur.filters.filter((x) => x !== f); cur.offset = 0; load(); }; on.append(b);
    }
    cur.sort.forEach((s, i) => {
      const [c, d] = s.split(':');
      const b = E('button', 'chipbtn on sortp', `${cur.sort.length > 1 ? i + 1 + '. ' : ''}${cname(c)} ${d === 'desc' ? '▼ 큰 것부터' : '▲ 작은 것부터'} ✕`); b.type = 'button'; b.title = '이 정렬 풀기';
      b.onclick = () => { cur.sort.splice(i, 1); cur.offset = 0; load(); }; on.append(b);
    });
    if (n || cur.q || cur.preset) {
      const clr = E('button', 'btn sm ghost', '모두 풀기'); clr.type = 'button';
      clr.onclick = () => { cur.filters = []; cur.sort = []; cur.q = ''; cur.preset = ''; cur.offset = 0; document.querySelector('.dt-q').value = ''; load(); };
      on.append(clr);
    }
    if (on.childNodes.length) body.append(on);
    // 열 필터 만들기
    const cols = last.allcols || last.cols;
    if (!cols.includes(fcol)) fcol = last.cols[0];
    const cs = select([], null); for (const c of cols) { const o = E('option', null, cname(c)); o.value = c; if (c === fcol) o.selected = true; cs.append(o); }
    cs.setAttribute('aria-label', '필터할 칸');
    const ex = cur.filters.find((x) => x.c === fcol) || {};
    const ops = [['in', '여러 값 고르기'], ['has', '글자 들어감'], ['eq', '똑같음'], ...((isNum(fcol) || isDate(fcol)) ? [['range', isNum(fcol) ? '숫자 범위' : '날짜 범위']] : []), ['blank', '빈칸만'], ['notblank', '빈칸 빼고']];
    const os = E('select'); os.setAttribute('aria-label', '어떻게');
    for (const [v, l] of ops) { const o = E('option', null, l); o.value = v; if (v === (ex.op || 'in')) o.selected = true; os.append(o); }
    const area = E('div', 'dt-fp-area');
    cs.onchange = () => { fcol = cs.value; panel(); };
    const draw = () => editor(area, fcol, os.value, ex);
    os.onchange = draw;
    const row = E('div', 'dt-fp-row'); row.append(field('칸', cs), field('어떻게', os));
    const box = E('div', 'dt-form'); box.append(E('div', 'od-t', '열 필터'), row, area); body.append(box);
    draw();
    // 정렬(휴대폰은 Shift+클릭이 없어서 여기서 여러 열)
    const ss = select([], null); for (const c of cols) { const o = E('option', null, cname(c)); o.value = c; ss.append(o); }
    ss.setAttribute('aria-label', '정렬할 칸');
    const add = (d) => () => { cur.sort = cur.sort.filter((x) => x.split(':')[0] !== ss.value).concat(`${ss.value}:${d}`); cur.offset = 0; load(); };
    const sb = E('div', 'dt-form'); const sr = E('div', 'dt-fp-row');
    sr.append(field('칸', ss), btn('▲ 작은 것부터', 'weak', add('asc')), btn('▼ 큰 것부터', 'weak', add('desc')));
    sb.append(E('div', 'od-t', '정렬 더하기'), E('p', 'muted small', '표 머리를 누르면 그 칸으로 정렬(누를 때마다 작은 것부터 → 큰 것부터 → 해제), Shift를 누른 채 누르면 여러 칸. 빈칸은 늘 맨 뒤.'), sr);
    body.append(sb);
    // 열 보이기·고정(보기만 바뀜 — 시트 열 구조는 그대로, 보기 저장에 함께 남음)
    const cb = E('div', 'dt-form'); const cl = E('div', 'dt-cols');
    for (const c of last.cols) {
      const l = E('div', 'dt-col');
      const vis = E('input'); vis.type = 'checkbox'; vis.checked = !cur.hide.includes(c); vis.setAttribute('aria-label', `${cname(c)} 보이기`);
      vis.onchange = () => { cur.hide = vis.checked ? cur.hide.filter((x) => x !== c) : cur.hide.concat(c); saveHash(); render(); };
      const pn = E('button', 'chipbtn' + (cur.pin.includes(c) ? ' on' : ''), '📌'); pn.type = 'button'; pn.title = '왼쪽에 고정'; pn.setAttribute('aria-pressed', String(cur.pin.includes(c)));
      pn.setAttribute('aria-label', `${cname(c)} 고정`);
      pn.onclick = () => { cur.pin = cur.pin.includes(c) ? cur.pin.filter((x) => x !== c) : cur.pin.concat(c); saveHash(); render(); panel(); };
      const lab = E('label', null); lab.append(vis, E('span', null, cname(c)));
      l.append(lab, pn); cl.append(l);
    }
    const cr = E('div', 'dt-fp-row');
    cr.append(btn('모두 보이기', 'ghost', () => { cur.hide = []; saveHash(); render(); panel(); }), btn('고정 풀기', 'ghost', () => { cur.pin = []; saveHash(); render(); panel(); }));
    cb.append(E('div', 'od-t', `열 보이기·고정 (${last.cols.length - cur.hide.filter((x) => last.cols.includes(x)).length}/${last.cols.length}칸 보임)`),
      E('p', 'muted small', '체크를 끄면 숨기고, 📌은 왼쪽에 붙여 옆으로 넘겨도 보여요. 보기에만 적용돼요.'), cl, cr);
    body.append(cb);
    // 저장한 보기
    const vb = E('div', 'dt-form'); const vr = E('div', 'dt-fp-row');
    const vv = views(), names = Object.keys(vv);
    const vs = select(names.length ? names : ['(저장한 보기 없음)'], null); vs.setAttribute('aria-label', '저장한 보기');
    const nm = inp('새 보기 이름(예: 독일 매입대기)'); nm.setAttribute('aria-label', '보기 이름');
    const out = E('span', 'muted small');
    vr.append(field('저장한 보기', vs),
      btn('불러오기', 'weak', () => { const s = views()[vs.value]; if (s && fromState(s)) { loadTables(); load(); } }),
      btn('지우기', 'ghost', () => { const v = views(); if (!(vs.value in v)) return; if (!confirm(`'${vs.value}' 보기를 지울까요?`)) return; delete v[vs.value]; putViews(v); panel(); }));
    const vr2 = E('div', 'dt-fp-row');
    vr2.append(field('이름', nm), btn('지금 보기 저장', 'primary', () => {
      const name = nm.value.trim(); if (!name) { out.textContent = '이름을 적어 주세요'; return; }
      const v = views(); v[name] = { t: cur.table, p: cur.preset, q: cur.q, f: cur.filters, s: cur.sort, h: cur.hide, pin: cur.pin };
      out.textContent = putViews(v) ? `'${name}' 저장했어요(이 브라우저에만)` : '저장하지 못했어요(브라우저 저장소가 막힘)'; nm.value = ''; panel();
    }), out);
    vb.append(E('div', 'od-t', '보기 저장(이 브라우저에만)'), vr, vr2);
    body.append(vb);
    p.append(body);
  }

  function editor(area, c, op, ex) {
    area.textContent = '';
    const same = ex.op === op;
    const apply = (f) => { setFilter(c, f); load(); };
    if (op === 'has' || op === 'eq') {
      const i = inp(op === 'has' ? '들어간 글자' : '같은 값(비우면 빈칸)', same ? ex.v : ''); i.setAttribute('aria-label', '값');
      i.onkeydown = (e) => { if (e.key === 'Enter') apply({ c, op, v: i.value.trim() }); };
      area.append(field('값', i), btn('걸기', 'primary', () => apply({ c, op, v: i.value.trim() })));
    } else if (op === 'range') {
      const lo = inp(isNum(c) ? '부터(숫자)' : '부터 예: 2026-10-01', same ? ex.lo : ''), hi = inp(isNum(c) ? '까지(숫자)' : '까지 예: 2026-10-23', same ? ex.hi : '');
      if (isNum(c)) { lo.inputMode = 'decimal'; hi.inputMode = 'decimal'; } else { lo.type = 'date'; hi.type = 'date'; }
      const r = E('div', 'dt-fp-row'); r.append(field('부터', lo), field('까지', hi));
      area.append(r, btn('걸기', 'primary', () => apply(lo.value.trim() || hi.value.trim() ? { c, op, lo: lo.value.trim(), hi: hi.value.trim() } : null)));
    } else if (op === 'blank' || op === 'notblank') {
      area.append(btn(op === 'blank' ? '빈칸만 보기' : '빈칸 빼고 보기', 'primary', () => apply({ c, op })));
    } else {                     // 여러 값 고르기 — 다른 필터가 걸린 채 이 칸 값 목록(찾기 가능, 개수 제한 없이 찾아서)
      const chosen = new Set(same ? ex.vs : []);
      const find = inp('값 찾기'); find.type = 'search'; find.setAttribute('aria-label', '값 찾기');
      const list = E('div', 'dt-vals'); const note = E('div', 'muted small');
      let tm;
      const fill = async () => {
        const ps = params(); ps.set('col', c); ps.set('find', find.value.trim()); ps.set('limit', '300');
        let j; try { j = await fetchJ('/api/db/values?' + ps.toString()); } catch (e) { note.textContent = '값 목록을 못 불러왔어요: ' + e.message; return; }
        if (j.error) { note.textContent = j.error; return; }
        list.textContent = '';
        for (const [v, cnt] of j.values) {
          const l = E('label', 'dt-val'); const cb = E('input'); cb.type = 'checkbox'; cb.checked = chosen.has(v);
          cb.onchange = () => { cb.checked ? chosen.add(v) : chosen.delete(v); cnt2(); };
          l.append(cb, E('span', null, blankName(c, v)), E('span', 'dt-n', String(cnt))); list.append(l);
        }
        note.textContent = j.distinct > j.values.length ? `값 ${j.distinct.toLocaleString('ko-KR')}개 중 줄 많은 ${j.values.length}개 — 찾기로 좁혀 주세요` : `값 ${j.distinct.toLocaleString('ko-KR')}개`;
      };
      const go = btn('고른 값으로 걸기', 'primary', () => apply(chosen.size ? { c, op: 'in', vs: [...chosen] } : null));
      const cnt2 = () => { go.textContent = chosen.size ? `고른 ${chosen.size}개로 걸기` : '고른 값 없음(필터 풀기)'; };
      find.oninput = () => { clearTimeout(tm); tm = setTimeout(fill, 250); };
      area.append(field('찾기', find), note, list, go); cnt2(); fill();
    }
  }
  function openFilter(c) { fcol = c; const p = $('dt-fpanel'); if (p) { p.open = true; panel(); p.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }

  async function loadTables() {
    const box = document.querySelector('.dt-tables'); if (!box) return;
    try {
      const ts = await fetchJ('/api/db/tables');
      box.textContent = '';
      for (const t of ts) {
        const b = E('button', 'tab', null); b.type = 'button';
        b.setAttribute('aria-selected', String(t.name === cur.table));
        b.append(document.createTextNode(t.label), E('span', 'dt-n', t.count.toLocaleString('ko-KR')));
        b.onclick = () => {
          if (Object.keys(pending).length && !confirm('저장 안 한 칸이 있어요. 버리고 다른 표로 갈까요?')) return;
          pending = {}; picked.clear();
          cur = DEF(t.name); fcol = '';
          document.querySelector('.dt-q').value = ''; sel = null; detail(); loadTables(); load();
        };
        box.append(b);
      }
    } catch (e) { box.textContent = '표 목록을 불러오지 못했어요: ' + e.message; }
  }

  function chips(box, label, items, isOn, onPick, allOn, onAll, col) {
    const g = E('div', 'dt-facet'); g.append(E('span', 'muted small', label + ' '));
    const all = E('button', 'chipbtn' + (allOn ? ' on' : ''), '전체'); all.type = 'button'; all.setAttribute('aria-pressed', String(allOn)); all.onclick = onAll; g.append(all);
    for (const [v, n] of items) {
      const b = E('button', 'chipbtn' + (isOn(v) ? ' on' : ''), `${col ? blankName(col, v) : v} ${n.toLocaleString('ko-KR')}`); b.type = 'button';
      b.setAttribute('aria-pressed', String(isOn(v))); b.onclick = (e) => onPick(v, e); if (col) b.title = '누르면 이것만 · ⌘/Ctrl+클릭은 여러 개 같이'; g.append(b);
    }
    if (col && items.length >= 15) { const m = E('button', 'chipbtn', '더 보기…'); m.type = 'button'; m.onclick = () => openFilter(col); g.append(m); }
    box.append(g);
  }

  let seq = 0;
  async function load() {
    const wrap = document.querySelector('.dt-wrap'); if (!wrap) return;
    const ps = params(); ps.set('offset', cur.offset); ps.set('limit', isSheet() ? 100 : 50);
    if (cur.sort.length) ps.set('sort', cur.sort.join(','));
    const my = ++seq;          // 빨리 여러 번 누르면 마지막 요청만 그림
    let j; try { j = await fetchJ('/api/db/rows?' + ps.toString()); } catch (e) { wrap.textContent = '불러오지 못했어요: ' + e.message; return; }
    if (my !== seq) return;
    saveHash();
    if (j.error) {
      wrap.textContent = '';
      const b = E('button', 'btn sm weak', '필터·정렬 모두 풀기'); b.type = 'button';
      b.onclick = () => { cur.filters = []; cur.sort = []; cur.offset = 0; load(); };
      wrap.append(E('p', null, '⚠ ' + j.error + ' '), b); return;
    }
    last = j;
    const pb = document.querySelector('.dt-presets'); pb.textContent = '';
    if ((last.presets || []).length) chips(pb, '할 일', last.presets, (v) => cur.preset === v, (v) => { cur.preset = cur.preset === v ? '' : v; cur.offset = 0; load(); }, !cur.preset, () => { cur.preset = ''; cur.offset = 0; load(); });
    const fb = document.querySelector('.dt-facets'); fb.textContent = '';
    for (const [f, vals] of Object.entries(last.facets || {})) {
      const fin = cur.filters.find((x) => x.c === f && x.op === 'in');
      const has = cur.filters.some((x) => x.c === f);
      chips(fb, cname(f), vals, (v) => !!fin && fin.vs.includes(v == null ? '' : v), (v, e) => { pickVal(f, v == null ? '' : v, e && (e.metaKey || e.ctrlKey || e.shiftKey)); load(); }, !has, () => { setFilter(f, null); load(); }, f);
    }
    panel();
    stockForm();
    render();
    const more = document.querySelector('.dt-more'); more.textContent = '';
    more.append(E('span', 'muted small', `${last.total.toLocaleString('ko-KR')}줄 중 ${last.total ? cur.offset + 1 : 0}–${cur.offset + last.rows.length}` + (isSheet() && last.source ? ` · ${last.source}` : '')));
    const step = isSheet() ? 100 : 50;
    if (cur.offset > 0) { const b = E('button', 'btn sm ghost', '‹ 앞'); b.type = 'button'; b.onclick = () => { cur.offset = Math.max(0, cur.offset - step); load(); }; more.append(b); }
    if (cur.offset + last.rows.length < last.total) { const b = E('button', 'btn sm ghost', '다음 ›'); b.type = 'button'; b.onclick = () => { cur.offset += step; load(); }; more.append(b); }
    bar();
  }

  // ── 표 그리기(주문 시트는 칸 고치기·줄 고르기) ──
  const isStock = (r) => r && String(r.key || '').includes('#');
  function canEdit(c, r) {
    const ed = last && last.edit; if (!ed) return false;
    if (ed.editable.includes(c)) return true;
    return ed.stock_only.includes(c) && (r == null || isStock(r));
  }
  const sheetCol = (c) => (last.heads || {})[c] || (last.edit.cols || {})[c] || c;
  const rowName = (r) => (isStock(r) ? r.rkey : r.key) || '';      // 바꾼 기록·색·메모가 줄을 따라가는 이름
  const ident = (r) => ({ 상품명: r.name || '', 공홈주문번호: r.shop_order || '', 수령인: r.receiver || '' });

  const cellVal = (r, c) => { const p = pending[`${rid(r)}:${c}`]; return p ? p.new : (r[c] == null ? '' : String(r[c])); };
  const noteOf = (r, c) => ((r._meta || {}).notes || {})[c];
  const rowColor = (r) => (r._meta || {}).ucolor || (r._meta || {}).color || '';

  function render() {
    const wrap = document.querySelector('.dt-wrap'); wrap.textContent = '';
    const ed = isSheet() ? (last.edit || {}) : null;
    const cols = visCols();
    const tbl = E('table', 'dt' + (ed ? ' sheet' : '')); const thead = E('thead'); const tr = E('tr');
    if (ed) {
      const th = E('th', 'pick'); const all = E('input'); all.type = 'checkbox'; all.setAttribute('aria-label', '이 화면 줄 모두 고르기');
      all.checked = last.rows.length > 0 && last.rows.every((r) => picked.has(rid(r)));
      all.onchange = () => { for (const r of last.rows) all.checked ? picked.add(rid(r)) : picked.delete(rid(r)); render(); bar(); };
      th.append(all); tr.append(th);
    }
    for (const c of cols) {
      const th = E('th'); if (ed && canEdit(c, null)) th.classList.add('edh');
      if (cur.pin.includes(c)) th.classList.add('pin');
      const so = sortOf(c);
      th.setAttribute('aria-sort', so ? (so.d === 'asc' ? 'ascending' : 'descending') : 'none');
      const sb = E('button', 'th-sort', cname(c)); sb.type = 'button';
      sb.title = '눌러서 정렬(작은 것부터 → 큰 것부터 → 해제) · Shift+클릭은 여러 칸';
      if (so) sb.append(E('span', 'th-ar', (so.d === 'asc' ? ' ▲' : ' ▼') + (cur.sort.length > 1 ? so.i + 1 : '')));
      sb.onclick = (e) => clickSort(c, e.shiftKey);
      const fb = E('button', 'th-filt' + (cur.filters.some((x) => x.c === c) ? ' on' : ''), '⏷'); fb.type = 'button';
      fb.setAttribute('aria-label', `${cname(c)} 필터`); fb.title = '이 칸 필터';
      fb.onclick = () => openFilter(c);
      th.append(sb, fb); tr.append(th);
    }
    thead.append(tr); tbl.append(thead);
    const tb = E('tbody');
    for (const r of last.rows) {
      const row = E('tr'); row.tabIndex = 0;
      if (ed && r.problem) row.classList.add('prob');
      if (ed && (isStock(r) || String(r.progress || '').startsWith('재고'))) row.classList.add('stock');
      if (sel && ed && rid(sel) === rid(r)) row.classList.add('on');
      else if (ed && !r.problem && rowColor(r)) { row.classList.add('painted'); row.style.setProperty('--row-bg', rowColor(r)); }   // 시트 배경색(grid_meta)
      if (ed) {
        const td = E('td', 'pick'); const cb = E('input'); cb.type = 'checkbox'; cb.checked = picked.has(rid(r));
        cb.setAttribute('aria-label', `${r.tab} ${r.row}행 고르기`);
        cb.onclick = (e) => e.stopPropagation();
        cb.onchange = () => { cb.checked ? picked.add(rid(r)) : picked.delete(rid(r)); bar(); };
        td.append(cb); row.append(td);
      }
      for (const c of cols) {
        const td = E('td');
        if (cur.pin.includes(c)) td.classList.add('pin');
        const pk = ed && pending[`${rid(r)}:${c}`];
        const v = pk ? pk.new : fmt(c, r[c]);
        if (['state', 'status', 'handling', 'progress'].includes(c) && v) td.append(E('span', 'badge ' + badgeCls(v), v));
        else td.textContent = v.length > 60 ? v.slice(0, 59) + '…' : v;
        const nt = ed && noteOf(r, c);
        if (nt) {           // 칸 메모(시트의 메모 대신) — 오른쪽 위 세모, 마우스를 올리면 내용
          td.classList.add('has-note'); td.title = `메모: ${nt.text}${nt.by ? ` — ${nt.by}` : ''}`;
          td.append(E('span', 'note-dot', '◥'));
        }
        if (ed && canEdit(c, r)) {
          td.classList.add('ed'); if (!nt) td.title = '눌러서 고치기 · 엑셀에서 복사한 여러 칸은 칸을 누른 뒤 붙여넣기';
          if (pk) td.classList.add('dirty');
          td.onclick = (e) => { e.stopPropagation(); cellEdit(td, r, c); };
        }
        row.append(td);
      }
      const open = () => { sel = r; detail(); document.querySelectorAll('.dt tbody tr').forEach((x) => x.classList.remove('on')); row.classList.add('on'); };
      row.onclick = open; row.onkeydown = (e) => { if (e.key === 'Enter' && e.target === row) open(); };
      tb.append(row);
    }
    if (!last.rows.length) { const e = E('tr'); const td = E('td', 'empty', '맞는 줄이 없어요'); td.colSpan = cols.length + (ed ? 1 : 0); e.append(td); tb.append(e); }
    tbl.append(tb); wrap.append(tbl);
    pinLeft(tbl);
  }
  function pinLeft(tbl) {        // 고정 칸: 앞 칸 너비만큼 왼쪽에 붙임(sticky)
    const hs = [...tbl.querySelectorAll('thead th')]; let left = 0; const at = {};
    hs.forEach((th, i) => { if (th.classList.contains('pick') || th.classList.contains('pin')) { at[i] = left; left += th.offsetWidth; } });
    for (const tr of tbl.querySelectorAll('tr')) [...tr.children].forEach((td, i) => { if (i in at && (td.classList.contains('pin'))) td.style.left = at[i] + 'px'; });
  }

  function stage(r, c, val, op) {
    const k = `${rid(r)}:${c}`, old = r[c] == null ? '' : String(r[c]);
    if (val === old) delete pending[k];
    else pending[k] = { tab: r.tab, row: r.row, key: r.key, col: sheetCol(c), old, new: val, ident: ident(r), op: op || '칸' };
  }
  const pendingOp = () => { const ops = new Set(Object.values(pending).map((x) => x.op || '칸')); return ops.size === 1 ? [...ops][0] : '일괄'; };

  // ── 여러 칸 붙여넣기·아래로 채우기 — 저장 전 미리보기(확인하면 '저장 안 한 칸'에 들어가고, 저장은 아래 막대에서 같은 길) ──
  function pasteGrid(r0, c0, text) {
    const lines = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));
    const cols = visCols(), ci = cols.indexOf(c0), ri = last.rows.indexOf(r0);
    const plan = [], skip = [];
    lines.forEach((vals, i) => {
      const r = last.rows[ri + i];
      if (!r) { skip.push(`${i + 1}번째 줄: 이 화면에 줄이 없어요(다음 쪽이거나 끝)`); return; }
      vals.forEach((v, j) => {
        const c = cols[ci + j];
        if (!c) { skip.push(`${r.tab} ${r.row}행 ${j + 1}번째 값: 오른쪽에 칸이 없어요`); return; }
        if (!canEdit(c, r)) { if (v.trim() !== cellVal(r, c)) skip.push(`${r.tab} ${r.row}행 ${cname(c)}: 고칠 수 없는 칸(자동 계산·플랫폼 값)`); return; }
        const opts = dropOpts(r, c);
        if (opts && v.trim() && !opts.includes(v.trim())) skip.push(`${r.tab} ${r.row}행 ${cname(c)}: '${v.trim()}'은(는) 선택 목록에 없어요 — 그래도 넣어요`);
        if (v.trim() !== cellVal(r, c)) plan.push({ r, c, v: v.trim() });
      });
    });
    preview('붙여넣기', plan, skip, '붙여넣기');
  }
  function fillDown(c) {
    const rows = last.rows.filter((x) => picked.has(rid(x)));
    if (rows.length < 2) { alertBar('⚠ 줄을 두 개 이상 골라 주세요(맨 위 줄 값을 아래 줄에 채워요)'); return; }
    const src = rows[0], v = cellVal(src, c);
    const plan = [], skip = [];
    for (const r of rows.slice(1)) { if (!canEdit(c, r)) skip.push(`${r.tab} ${r.row}행 ${cname(c)}: 고칠 수 없는 칸`); else if (cellVal(r, c) !== v) plan.push({ r, c, v }); }
    preview(`아래로 채우기 — ${src.tab} ${src.row}행 ${cname(c)} '${v || '빈칸'}'`, plan, skip, '채우기');
  }
  function preview(title, plan, skip, op) {
    let dlg = $('dt-prev'); if (dlg) dlg.remove();
    dlg = E('dialog', 'dt-prev'); dlg.id = 'dt-prev'; dlg.setAttribute('aria-label', title);
    const box = E('div', 'dt-prev-box');
    box.append(E('h3', null, `${title} — ${plan.length}칸 바뀜`));
    const ul = E('ul', 'dt-ev');
    for (const p of plan.slice(0, 300)) ul.append(E('li', null, `${p.r.tab} ${p.r.row}행 ${p.r.receiver || p.r.name || ''} · ${cname(p.c)}: '${cellVal(p.r, p.c) || '빈칸'}' → '${p.v || '빈칸'}'`));
    if (plan.length > 300) ul.append(E('li', 'muted', `… 외 ${plan.length - 300}칸`));
    if (!plan.length) ul.append(E('li', 'muted', '바뀌는 칸이 없어요'));
    box.append(ul);
    if (skip.length) { const s = E('ul', 'dt-ev warn'); for (const x of skip.slice(0, 50)) s.append(E('li', null, '⚠ ' + x)); box.append(E('p', 'small', `넣지 않거나 확인할 것 ${skip.length}개`), s); }
    box.append(E('p', 'muted small', '확인하면 아직 저장하지 않은 칸으로 들어가요 — 아래 막대의 [시트에 저장]을 눌러야 저장돼요(지금 값과 다르면 그 칸은 저장하지 않아요).'));
    const bs = E('div', 'btns');
    bs.append(btn('취소', 'ghost', () => dlg.close()), btn(`${plan.length}칸 넣기`, 'primary', () => { for (const p of plan) stage(p.r, p.c, p.v, op); dlg.close(); render(); bar(); }));
    box.append(bs); dlg.append(box); document.body.append(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }
  const dropOpts = (r, c) => { const d = ((last.dropdowns || {})[r.tab] || {})[c]; return d || (c === 'ship_mode' ? last.edit.methods : null); };

  function cellEdit(td, r, c) {
    if (td.querySelector('input,select')) return;
    const k = `${rid(r)}:${c}`, now = pending[k] ? pending[k].new : (r[c] == null ? '' : String(r[c]));
    let el;
    const opts = dropOpts(r, c);          // 선택 목록 칸(시트 드롭다운 — grid_meta). 목록 밖 지금 값도 그대로 고를 수 있게(시트도 경고만)
    if (opts) { el = E('select'); for (const o of ['', ...opts, ...(now && !opts.includes(now) ? [now] : [])]) { const x = E('option', null, o || '(비움)'); x.value = o; if (o === now) x.selected = true; el.append(x); } }
    else {
      el = E('input'); el.value = now;
      el.onpaste = (e) => {     // 엑셀·시트에서 복사한 여러 칸(탭·줄바꿈) → 이 칸부터 미리보기
        const t = (e.clipboardData || window.clipboardData).getData('text');
        if (!/[\t\n]/.test(t.replace(/\n+$/, ''))) return;
        e.preventDefault(); finish(false, () => pasteGrid(r, c, t));
      };
    }
    el.className = 'cell-in'; el.setAttribute('aria-label', `${r.tab} ${r.row}행 ${cname(c)}`);
    td.textContent = ''; td.append(el); el.focus(); if (el.select) el.select();
    let done = false;
    const finish = (save, then) => { if (done) return; done = true; if (save) stage(r, c, el.value.trim()); render(); bar(); if (then) then(); };
    el.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') finish(false);
      else if (e.key === 'Tab') { e.preventDefault(); finish(true, () => nextCell(r, c, e.shiftKey ? -1 : 1)); }
    };
    el.onblur = () => finish(true);
    if (opts) el.onchange = () => finish(true);
    el.onclick = (e) => e.stopPropagation();
  }
  function nextCell(r, c, dir) {      // Tab = 옆의 고칠 수 있는 칸으로(시트처럼)
    const vc = visCols(), cols = vc.filter((x) => canEdit(x, r)); const i = cols.indexOf(c) + dir;
    if (i < 0 || i >= cols.length) return;
    const tr = document.querySelectorAll('.dt tbody tr')[last.rows.indexOf(r)];
    const td = tr && tr.children[vc.indexOf(cols[i]) + 1];
    if (td) cellEdit(td, r, cols[i]);
  }

  // ── 아래 고정 막대: 저장 안 한 칸 · 고른 줄에 같은 값 ──
  function bar() {
    const b = $('dt-bar'); if (!b) return;
    const n = Object.keys(pending).length, m = picked.size;
    b.hidden = !isSheet() || (!n && !m); b.textContent = ''; if (b.hidden) return;
    if (m) {
      const g = E('div', 'dt-bar-g');
      const s = E('select'); s.setAttribute('aria-label', '넣을 칸');
      for (const c of (last.edit.editable || [])) { const o = E('option', null, COLNAME[c] || c); o.value = c; s.append(o); }
      const v = E('input'); v.placeholder = '같은 값'; v.setAttribute('aria-label', '넣을 값');
      const go = E('button', 'btn sm', `고른 ${m}줄에 넣기`); go.type = 'button';
      go.onclick = () => { for (const r of last.rows.filter((x) => picked.has(rid(x)))) if (canEdit(s.value, r)) stage(r, s.value, v.value.trim(), '일괄'); render(); bar(); };
      const fill = E('button', 'btn sm', '맨 위 줄 값으로 아래 채우기'); fill.type = 'button'; fill.title = '고른 줄 중 맨 위 줄의 이 칸 값을 나머지 고른 줄에(미리보기 뒤)';
      fill.onclick = () => fillDown(s.value);
      const clr = E('button', 'btn sm ghost', '고르기 풀기'); clr.type = 'button'; clr.onclick = () => { picked.clear(); render(); bar(); };
      g.append(E('b', null, `${m}줄 고름`), s, v, go, fill, clr); b.append(g);
    }
    if (n) {
      const g = E('div', 'dt-bar-g');
      const undo = E('button', 'btn sm ghost', '고친 것 버리기'); undo.type = 'button'; undo.onclick = () => { pending = {}; render(); bar(); };
      const save = E('button', 'btn sm primary', `시트에 저장 (${n}칸)`); save.type = 'button';
      save.onclick = () => saveEdits(false, save);
      g.append(E('b', null, `${n}칸 바뀜`), E('span', 'muted small', Object.values(pending).slice(0, 3).map((x) => `${x.tab} ${x.row}행 ${x.col}`).join(' · ') + (n > 3 ? ' …' : '')), undo, save);
      b.append(g);
    }
    const msg = E('div', 'dt-bar-msg'); msg.id = 'dt-bar-msg'; msg.setAttribute('role', 'status'); msg.hidden = true; b.append(msg);
  }
  function alertBar(t, force) {
    const b = $('dt-bar'); if (b) b.hidden = false;
    const m = $('dt-bar-msg'); if (!m) return; m.hidden = false; m.textContent = t;
    if (force) { const x = E('button', 'btn sm weak', '그래도 저장'); x.type = 'button'; x.onclick = () => saveEdits(true, x); m.append(' ', x); }
  }
  async function saveEdits(force, btn) {
    const edits = Object.values(pending); if (!edits.length) return;
    btn.disabled = true; btn.textContent = '시트에 쓰는 중… (10–20초)';
    try {
      const j = await post({ kind: 'sheet_edit', edits: edits.map(({ op, ...e }) => e), op: pendingOp(), force });
      if (/회차가 시트를 쓰는 중/.test(j.msg)) { bar(); alertBar('⚠ ' + j.msg, true); return; }
      const failed = new Set((j.msg.match(/• \S+ \d+행 [^:]+:/g) || []).map((s) => s.slice(2, -1)));
      const failedRows = new Set((j.msg.match(/• \S+ \d+행:/g) || []).map((s) => s.slice(2, -1)));    // 줄 통째로 못 씀(쓰는 순간 줄이 바뀜)
      const unsure = /줄마다 확인하지 못했어요/.test(j.msg);
      for (const [k, e] of Object.entries(pending)) if (!unsure && !failed.has(`${e.tab} ${e.row}행 ${e.col}`) && !failedRows.has(`${e.tab} ${e.row}행`)) delete pending[k];
      await load();
      alertBar((j.ok ? '✅ ' : '⚠ ') + j.msg);
    } catch (e) { alertBar('⚠ ' + e.message); } finally { btn.disabled = false; }
  }

  async function post(payload) {
    const r = await (window.barunFetch || fetch)('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action: 'db' }, payload)) });
    return r.json();
  }
  async function doAct(payload, btn, out) {
    if (payload.confirm && !confirm(payload.confirm)) return;
    delete payload.confirm;
    const label = btn && btn.textContent;
    if (btn) { btn.disabled = true; if (payload.kind.startsWith('sheet')) btn.textContent = '시트에 쓰는 중…'; }
    try {
      const j = await post(payload);
      if (out) {
        out.textContent = (j.ok ? '✅ ' : '⚠ ') + j.msg; out.hidden = false;
        if (/회차가 시트를 쓰는 중/.test(j.msg)) { const b = E('button', 'btn sm weak', '그래도 하기'); b.type = 'button'; b.onclick = () => doAct(Object.assign({}, payload, { force: true }), b, out); out.append(' ', b); }
      }
      if (j.ok && !payload.kind.endsWith('preview')) { load(); loadTables(); }
      return j;
    } catch (e) { if (out) { out.textContent = '⚠ ' + e.message; out.hidden = false; } } finally { if (btn) { btn.disabled = false; btn.textContent = label; } }
  }

  const field = (lab, input) => { const l = E('label', 'dt-field'); l.append(E('span', null, lab), input); return l; };
  const inp = (ph, val) => { const i = E('input'); i.placeholder = ph || ''; if (val != null) i.value = val; return i; };
  const select = (opts, val) => { const s = E('select'); for (const o of opts) { const x = E('option', null, o); x.value = o; if (o === val) x.selected = true; s.append(x); } return s; };
  const form = (title, ...kids) => { const g = E('div', 'dt-form'); g.append(E('div', 'od-t', title), ...kids); return g; };
  const btn = (txt, cls, fn) => { const b = E('button', 'btn sm ' + (cls || 'weak'), txt); b.type = 'button'; b.onclick = () => fn(b); return b; };
  const tabsOf = () => ((last.tabs && last.tabs.length) ? last.tabs : ((last.facets || {}).tab || []).map((x) => x[0])).filter(Boolean);
  const tabPicked = () => { const f = cur.filters.find((x) => x.c === 'tab' && x.op === 'in' && x.vs.length === 1); return f ? f.vs[0] : undefined; };

  // ── 재고 줄 추가(주문 시트 위) ──
  function stockForm() {
    const box = document.querySelector('.dt-stock'); if (!box) return; box.textContent = '';
    if (!isSheet()) return;
    const f = E('div', 'dt-acts'); f.hidden = true;
    const open = btn('＋ 재고 줄 추가', 'ghost', () => { f.hidden = !f.hidden; });
    const tab = select(tabsOf(), tabPicked()), shop = inp('예: 아마존·츄위·공홈'), no = inp('공홈 주문번호'), price = inp('공홈가(외화)'), qty = inp('보낼수량', '1'),
      center = inp('배대지센터 예: 미국 NJ'), name = inp('상품명'), opt = inp('옵션(선택)'), tr = inp('해외송장(선택)'), car = inp('해외운송사(선택)'), memo = inp('메모(기본 오토쉽)');
    const out = E('div', 'what'); out.hidden = true;
    const go = btn('시트 맨 아래에 추가', 'primary', (b) => doAct({ kind: 'sheet_row', op: 'stock', tab: tab.value, shop: shop.value.trim(), order_no: no.value.trim(), price: price.value.trim(),
      qty: qty.value.trim(), center: center.value.trim(), name: name.value.trim(), 옵션: opt.value.trim(), 해외송장: tr.value.trim(), 해외운송사: car.value.trim(), 메모: memo.value.trim() }, b, out));
    f.append(form('재고 줄(수령인 빈칸 — 같은 공홈주문번호가 이미 있으면 넣지 않아요)', field('탭', tab), field('상품명', name), field('옵션', opt), field('구매처', shop), field('공홈주문번호', no),
      field('공홈가', price), field('보낼수량', qty), field('배대지센터', center), field('해외송장', tr), field('해외운송사', car), field('메모', memo), go, out));
    box.append(open, f);
  }

  // ── 줄 자세히 + 조치 ──
  function detail() {
    const box = $('dt-detail'); if (!box) return;
    box.hidden = !sel; box.textContent = ''; if (!sel) return;
    const r = sel;
    const head = E('div', 'od-head'); const tt = E('div', 'od-title');
    const ttl = isSheet() ? `${r.receiver || '(재고)'} · ${r.name || ''}` : (r.title || r.name || r.receiver || r.key || r.lead_id || r.source_key || '줄');
    tt.append(E('div', 'od-name', ttl), E('div', 'od-role', isSheet() ? `${r.tab} ${r.row}행 · ${r.progress || ''}` : `${last.label} · ${r.lead_id || r.key || r.listing_id || r.source_key || ''}`));
    const x = E('button', 'icon-btn', '✕'); x.type = 'button'; x.setAttribute('aria-label', '닫기'); x.onclick = () => { sel = null; detail(); if (isSheet()) render(); };
    head.append(tt, x); box.append(head);
    const dl = E('dl', 'kv');
    for (const [k, v] of Object.entries(r)) { if (v == null || v === '') continue; dl.append(E('dt', null, COLNAME[k] || k)); const dd = E('dd'); dd.append(E('pre', null, fmt(k, v))); dl.append(dd); }
    const out = E('div', 'what'); out.hidden = true; out.setAttribute('role', 'status');
    const acts = E('div', 'dt-acts');
    const A = last.actions || [];
    if (A.includes('sheet_edit')) sheetActs(r, acts, out);
    if (A.includes('order_mark') && r.key) {
      const h = select(['해외구매', '재고발송', '취소', '반품환불', '예외', '옛 주문', '미정'], r.handling), m = inp('메모(예: 재고로 보냄 — 호주 12행)');
      acts.append(form('처리 방식(장부)', E('p', 'muted small', '이 주문을 어떻게 처리했는지 남기면 감시가 다시 묻지 않아요.'), field('처리 방식', h), field('메모', m),
        btn('장부에 남기기', 'weak', (b) => doAct({ kind: 'order_mark', key: r.key, handling: h.value, memo: m.value.trim() }, b, out))));
    }
    if (A.includes('state')) {
      const s = select(STATES, r.state), m = inp('왜 바꾸는지(일지에 남아요)');
      acts.append(form('상태', field('새 상태', s), field('메모', m), btn('상태 바꾸기', 'weak', (b) => doAct({ kind: 'sourcing_state', lead_id: r.lead_id, state: s.value, memo: m.value }, b, out))));
    }
    if (A.includes('recheck')) {
      const c = inp('도착원가(원)', r.cost_krw), n = inp('네이버 최저가(원, 없으면 -)'), cp = inp('쿠팡 최저가(원, 없으면 -)'), m = inp('근거 한 줄(어디서 언제 봤는지)');
      acts.append(form('원가·시장가 재확인', field('도착원가', c), field('네이버 최저', n), field('쿠팡 최저', cp), field('근거', m),
        btn('다시 판정', 'weak', (b) => doAct({ kind: 'recheck', lead_id: r.lead_id, cost: c.value, naver: n.value, coupang: cp.value, memo: m.value }, b, out))));
    }
    if (A.includes('register')) {
      let plan = {}; try { plan = JSON.parse(r.plan || '{}') || {}; } catch (e) { /* 없음 */ }
      const how = select(['네이버옵션', '쿠팡옵션']), id = inp('네이버 그룹 번호 / 쿠팡 상품 번호'), q = inp('수량', r.quantity), p = inp('판매가(원)', plan.naver || ''), base = inp('기준 수량·순번(선택)');
      how.onchange = () => { p.value = (how.value === '네이버옵션' ? plan.naver : plan.coupang) || ''; };
      const args = () => {
        const a = [how.value, r.lead_id, how.value === '네이버옵션' ? '--그룹' : '--상품', id.value.trim(), '--수량', q.value.trim(), '--가격', p.value.trim()];
        if (base.value.trim()) a.push(how.value === '네이버옵션' ? '--기준수량' : '--기준순번', base.value.trim());
        return a;
      };
      const bs = E('div', 'btns');
      bs.append(btn('미리보기', '', (b) => doAct({ kind: 'register_preview', args: args() }, b, out)),
        btn('등록 실행', 'primary', (b) => doAct({ kind: 'register', args: args(), confirm: `${how.value === '네이버옵션' ? '네이버' : '쿠팡'}에 ${q.value}개 ${(+p.value).toLocaleString('ko-KR')}원으로 실제 등록할까요? 미리보기에서 막힌 것이 없었는지 확인해 주세요.` }, b, out)));
      acts.append(form('등록(공용 등록 도구)', field('방식', how), field('그룹·상품 번호', id), field('수량', q), field('판매가', p), field('기준', base), bs));
    }
    if (acts.childNodes.length) box.append(out, acts); else box.append(E('p', 'muted small', '이 표는 보기만 해요 — 바꿀 일은 #작업판에 말로 맡겨 주세요.'));
    const more = E('details', 'dt-all'); more.append(E('summary', null, '모든 칸 보기'), dl); box.append(more);
    if (isSheet() && rowName(r)) { const ab = E('div', 'dt-hist'); ab.append(E('div', 'od-t', '이 줄 바꾼 기록(현황판)')); box.append(ab); auditList(ab, { tab: r.tab, key: rowName(r), limit: 50 }); }
    if (r.key && !isStock(r) && (isSheet() || ['orders', 'order_ledger'].includes(cur.table))) historyBox(box, r);
    box.scrollTop = 0; x.focus();
  }

  // ── 바꾼 기록(grid_audit) · 되돌리기 · 지운 줄 되살리기 ──
  async function auditList(box, q) {
    const list = E('div', 'dt-audit-list'); box.append(list);
    const out = E('div', 'what'); out.hidden = true; out.setAttribute('role', 'status'); box.append(out);
    const draw = async () => {
      list.textContent = '불러오는 중…';
      let j; try { j = await fetchJ('/api/db/audit?' + new URLSearchParams(q).toString()); } catch (e) { list.textContent = '기록을 불러오지 못했어요: ' + e.message; return; }
      list.textContent = '';
      if (j.error) { list.textContent = j.error; return; }
      if (!j.batches.length) { list.append(E('p', 'muted small', '아직 현황판에서 바꾼 기록이 없어요')); return; }
      for (const b of j.batches) {
        const g = E('div', 'dt-batch');
        const h = E('div', 'dt-batch-h');
        h.append(E('b', null, `${fmt('at', b.at)} · ${b.by} · ${b.op}`), E('span', 'muted small', ` ${b.items.length}건`));
        const can = b.items.some((x) => UNDO_OPS.includes(x.op));
        if (can) h.append(btn(b.items.length > 1 ? '이 묶음 되돌리기' : '되돌리기', 'weak', (bt) => undo({ batch: b.batch }, bt, out, `${b.op} ${b.items.length}건을 되돌릴까요? (그사이 또 바뀐 칸은 되돌리지 않아요)`)));
        g.append(h);
        const ul = E('ul', 'dt-ev');
        for (const it of b.items.slice(0, 40)) {
          const li = E('li');
          const where = it.op === '일지실패' ? '' : `${it.tab} ${it.row ? it.row + '행 ' : ''}${it.col ? (COLNAME[it.col] || it.col) + ' ' : ''}`;
          li.append(document.createTextNode(it.op === '지우기' ? `${where}줄 지움: ${it.old}` : it.op === '되살리기' ? `${where}줄 되살림: ${it.new}`
            : `${where}'${it.old || '빈칸'}' → '${it.new || '빈칸'}'`));
          if (b.items.length > 1 && UNDO_OPS.includes(it.op)) { const u = btn(it.op === '지우기' ? '되살리기' : '이 칸만', 'ghost', (bt) => undo({ id: it.id }, bt, out)); li.append(' ', u); }
          ul.append(li);
        }
        if (b.items.length > 40) ul.append(E('li', 'muted', `… 외 ${b.items.length - 40}건`));
        g.append(ul); list.append(g);
      }
    };
    const undo = async (p, bt, o, ask) => {
      if (ask && !confirm(ask)) return;
      const j = await doAct(Object.assign({ kind: 'sheet_undo' }, p), bt, o);
      if (j && /회차가 시트를 쓰는 중/.test(j.msg || '')) return;
      if (j) draw();
    };
    draw();
    return draw;
  }
  async function deletedList(box) {
    const out = E('div', 'what'); out.hidden = true; out.setAttribute('role', 'status');
    const ul = E('ul', 'dt-ev'); box.append(ul, out);
    let j; try { j = await fetchJ('/api/db/deleted?limit=30'); } catch (e) { ul.append(E('li', 'muted', '불러오지 못했어요: ' + e.message)); return; }
    if (!j.rows.length) ul.append(E('li', 'muted', '지운 줄 백업이 없어요'));
    for (const d of j.rows) {
      const li = E('li', null, `${fmt('at', d.at)} · ${d.by} · ${d.tab} ${d.row || ''}행 ${d.receiver || '재고'} · ${d.name || ''} ${d.option || ''} `);
      li.append(btn('되살리기', 'ghost', (bt) => doAct({ kind: 'sheet_undo', line: d.line, confirm: `${d.receiver || '재고 ' + (d.name || '')} 줄을 ${d.tab} 탭 맨 아래에 되살릴까요?` }, bt, out)));
      ul.append(li);
    }
  }
  function auditPanel() {
    const box = document.querySelector('.dt-audit'); if (!box) return;
    box.hidden = !box.hidden; box.textContent = ''; if (box.hidden) return;
    box.append(E('div', 'od-t', '바꾼 기록 — 현황판에서 바꾼 모든 일(최근 것부터)'),
      E('p', 'muted small', '묶음(한 번에 저장한 것)이나 한 칸을 되돌릴 수 있어요. 지금 값이 그때 바꾼 값과 다르면(그사이 또 바뀜) 되돌리지 않아요. 지운 줄은 탭 맨 아래에 되살려요.'));
    auditList(box, { limit: 100 });
    const dd = E('details', 'dt-all'); dd.append(E('summary', null, '지운 줄 백업(기록 전에 지운 줄 포함)'));
    let done = false; dd.ontoggle = () => { if (dd.open && !done) { done = true; deletedList(dd); } };
    box.append(dd);
  }

  // 줄 조치는 접어 두고 '언제 쓰는지' 한 줄만(10/23 사장님 "이것이 어떤 이유 때문에 존재하는지 모르겠어") — 누르면 펼침. 시트에서 하던 일(메모·색·나누기·옮기기)을 시트 없이 하는 곳
  const tool = (title, why, ...kids) => {
    const d = E('details', 'dt-form dt-tool'); const sm = E('summary');
    sm.append(E('b', null, title), E('span', 'muted small', why)); d.append(sm, ...kids); d.open = title === '문제 줄'; return d;
  };
  function sheetActs(r, acts, out) {
    const ordered = r.key && !isStock(r);
    // 칸 고치기(표에서 누르기 어려운 휴대폰용 — 같은 저장 길)
    const cols = (last.edit.editable || []).concat(isStock(r) ? last.edit.stock_only : []);
    const c = select(cols.map((x) => COLNAME[x] || x)), v = inp('새 값');
    const syncV = () => { const k = cols[c.selectedIndex]; v.value = r[k] == null ? '' : r[k]; }; c.onchange = syncV; syncV();
    acts.append(tool('칸 고치기', '표에서 칸을 누르기 어려울 때(휴대폰) 값 고치기', field('칸', c), field('값', v), btn('시트에 저장', 'primary', (b) => {
      const k = cols[c.selectedIndex];
      doAct({ kind: 'sheet_edit', edits: [{ tab: r.tab, row: r.row, key: r.key, col: sheetCol(k), old: r[k] == null ? '' : String(r[k]), new: v.value.trim(), ident: ident(r) }] }, b, out);
    })));
    if (r.problem) acts.append(tool('문제 줄', '이 줄에 걸린 문제 — 해결했으면 풀기', E('p', 'small', r.problem), btn('문제 풀기(빨간색 해제)', 'weak', (b) => doAct({ kind: 'sheet_row', op: 'unproblem', tab: r.tab, row: r.row }, b, out))));
    else {
      const pc = select(['해외송장', '국내송장', '공홈주문번호', '공홈가', '구매처', '훗타운신청번호', '배송방식', '수령인', '메모']), why = inp('무엇이 문제인지(근거)'), todo = inp('할 일');
      acts.append(tool('문제 표시', '사람이 봐야 할 문제가 있을 때 — 빨간 줄 + #할-일 카드로 알려요', field('칸', pc), field('문제', why), field('할 일', todo),
        btn('문제로 표시', 'weak', (b) => doAct({ kind: 'sheet_row', op: 'problem', tab: r.tab, row: r.row, key: rowName(r), col: pc.value, why: why.value.trim(), todo: todo.value.trim() }, b, out))));
    }
    // 칸 메모·줄 색(시트의 메모·배경색 대신 — barun.db grid_meta, 줄이 밀려도 그 줄을 따라감)
    const mcols = visCols().filter((x) => !['tab', 'row'].includes(x));
    const mc = select(mcols.map(cname)), mt = inp('메모(비우면 지움)');
    const syncM = () => { const n = noteOf(r, mcols[mc.selectedIndex]); mt.value = n ? n.text : ''; }; mc.onchange = syncM; syncM();
    const metaPost = (b, kind, col, oldv, newv) => doAct({ kind: 'sheet_meta', tab: r.tab, row: r.row, key: isStock(r) ? '' : r.key, ident: ident(r), col, mkind: kind, old: oldv, new: newv }, b, out);
    acts.append(tool('칸 메모', '시트의 \'메모\' 대신 — 칸에 설명을 붙여 둬요(표에 ◥ 표시)', field('칸', mc), field('메모', mt), btn('메모 남기기', 'weak', (b) => {
      const k = mcols[mc.selectedIndex], n = noteOf(r, k);
      metaPost(b, 'note', sheetCol(k), n ? n.text : '', mt.value.trim());
    })));
    const pal = last.colors || {};
    const cs = select(['(없음)', ...Object.keys(pal)]); const nowC = (r._meta || {}).ucolor || '';
    cs.value = Object.keys(pal).find((k) => pal[k] === nowC) || '(없음)';
    acts.append(tool('줄 색', '시트에서 배경색 칠하던 것 대신 — 눈에 띄게 표시만 해요', E('p', 'muted small', (r._meta || {}).color ? `자동 색(재고·문제 등)이 있어요 — 사람 색이 그 위에 보여요.` : '사람이 표시해 두는 색이에요(자동 칠하기가 지우지 않아요).'),
      field('색', cs), btn('색 바꾸기', 'weak', (b) => metaPost(b, 'ucolor', '', nowC, pal[cs.value] || ''))));
    if (!ordered) { stockActs(r, acts, out); return; }
    const tot = +(r.send_qty || r.qty || 0) || 2;
    const keep = inp('이 줄 수량', String(Math.max(1, tot - 1))), mv = inp('새 줄 수량', '1');
    acts.append(tool('줄 나누기', '한 주문을 두 상자로 나눠 보낼 때(관세 US$150 넘을 때 등)', E('p', 'muted small', '같은 주문을 두 줄로 — 새 줄은 같은 탭 맨 아래, 송장·신청번호 칸은 비워요.'), field('이 줄 보낼수량', keep), field('새 줄 보낼수량', mv),
      btn('두 줄로 나누기', 'weak', (b) => doAct({ kind: 'sheet_row', op: 'split', tab: r.tab, row: r.row, key: r.key, keep: keep.value.trim(), move: mv.value.trim(),
        confirm: `${r.receiver} 주문을 ${keep.value}개 + ${mv.value}개 두 줄로 나눌까요?` }, b, out))));
    const to = select(tabsOf().filter((t) => t !== r.tab));
    acts.append(tool('다른 탭으로 옮기기', '배대지·나라 탭이 잘못 들어갔을 때', E('p', 'muted small', '새 탭 맨 아래로 옮기고, 다음부터 이 상품은 그 탭으로 들어가요.'), field('옮길 탭', to),
      btn('옮기기', 'weak', (b) => doAct({ kind: 'sheet_row', op: 'move', tab: r.tab, row: r.row, key: r.key, to: to.value, confirm: `${r.receiver} 줄을 ${r.tab} → ${to.value} 탭으로 옮길까요?` }, b, out))));
    acts.append(tool('줄 지우기', '잘못 들어온 줄을 지울 때(통째로 백업돼요)', E('p', 'muted small', '지운 주문은 다시 자동으로 들어오지 않아요. 지운 줄은 통째로 백업해 둬요. 같은 주문의 나눈 줄인지 먼저 확인해 주세요.'),
      btn('이 줄 지우기', 'danger', (b) => {
        const t = prompt(`정말 지우려면 받는 분 이름(${r.receiver})을 적어 주세요`);
        if (t == null) return;
        if (t.trim() !== String(r.receiver || '').trim()) { out.hidden = false; out.textContent = '이름이 달라 지우지 않았어요'; return; }
        doAct({ kind: 'sheet_row', op: 'delete', tab: r.tab, row: r.row, key: r.key }, b, out);
      })));
  }

  function stockActs(r, acts, out) {     // 재고 줄(key 없음): 옮기기·지우기 — 줄 번호 + 상품명·공홈주문번호·수령인이 화면과 같을 때만
    const name = r.name || r.shop_order || '재고';
    const to = select(tabsOf().filter((t) => t !== r.tab));
    acts.append(tool('다른 탭으로 옮기기', '재고를 다른 탭(배대지·나라)에 둘 때', E('p', 'muted small', '새 탭 맨 아래로 옮겨요.'), field('옮길 탭', to),
      btn('옮기기', 'weak', (b) => doAct({ kind: 'sheet_row', op: 'move', tab: r.tab, row: r.row, key: '', ident: ident(r), to: to.value, confirm: `재고 '${name}' 줄을 ${r.tab} → ${to.value} 탭으로 옮길까요?` }, b, out))));
    acts.append(tool('줄 지우기', '다 쓴·잘못 넣은 재고 줄을 지울 때(백업돼요)', E('p', 'muted small', '지운 줄은 통째로 백업해 둬요. 아직 쓰지 않은 재고인지 먼저 확인해 주세요.'),
      btn('이 재고 줄 지우기', 'danger', (b) => doAct({ kind: 'sheet_row', op: 'delete', tab: r.tab, row: r.row, key: '', ident: ident(r), confirm: `재고 '${name}'(${r.tab} ${r.row}행) 줄을 지울까요?` }, b, out))));
  }

  async function historyBox(box, r) {
    const h = E('div', 'dt-hist'); h.append(E('div', 'od-t', '이 주문 기록')); box.append(h);
    try {
      const j = await fetchJ('/api/db/history?key=' + encodeURIComponent(r.key));
      const o = j.order, l = j.ledger;
      const p = E('p', 'small'); p.style.whiteSpace = 'pre-wrap';
      p.textContent = [o ? `${o.platform === 'naver' ? '네이버' : '쿠팡'} · ${o.status || ''}${o.claim_status ? ' · 클레임 ' + o.claim_status : ''} · 결제 ${o.paid ? won(o.paid) : '-'} · 송장 ${o.invoice || '없음'}` : '플랫폼 주문 없음',
        l ? `처리 방식 ${l.handling}${l.memo ? ' (' + l.memo + ')' : ''}` : '', j.rows.length > 1 ? `시트 ${j.rows.length}줄: ` + j.rows.map((x) => `${x.tab} ${x.row}행`).join(', ') : ''].filter(Boolean).join('\n');
      h.append(p);
      const ul = E('ul', 'dt-ev');
      for (const e of j.events.slice(0, 30)) ul.append(E('li', null, `${fmt('at', e.at)} · ${e.src} · ${COLNAME[e.field] || e.field}: ${e.old || '빈칸'} → ${e.new || '빈칸'}`));
      if (!j.events.length) ul.append(E('li', 'muted', '바뀐 기록이 아직 없어요'));
      h.append(ul);
    } catch (e) { h.append(E('p', 'muted small', '기록을 불러오지 못했어요: ' + e.message)); }
  }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sel && !e.target.closest('input,select,textarea')) { sel = null; detail(); if (isSheet()) render(); } });
  window.addEventListener('beforeunload', (e) => { if (Object.keys(pending).length) { e.preventDefault(); e.returnValue = ''; } });
  window.barunData = () => { build(); readHash(); loadTables(); load(); };     // 주소에 보기 상태(#data?…)가 있으면 그대로
  const pd = document.getElementById('p-data');      // 주소가 #data로 열렸으면 이 파일이 늦게 읽혀도 바로 그림
  if (pd && !pd.hidden) window.barunData();
})();
