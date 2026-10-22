// 🗂 데이터 탭 — barun.db 표 찾아보기 + 바로 조치(2026-10-21 사장님: "디비도 현황판에서 접근하고 어떤 액션이든 바로",
//   "더이상 구글 스프레드시트를 사용하지 않을 수 있을 정도의 기능").
// 읽기: GET /api/db/tables · /api/db/rows?table=&q=&w_<칸>=&preset=&offset= · /api/db/history?key= (dashboard/dbview.py, 읽기 전용)
// 조치: POST /api/action {action:"db", kind, ...} → notify/actions.py → 주문 시트는 ops/orderedit.py(줄·먼저 고친 사람·회차 확인, 누른 사람 이름으로 일지)
// 주문 시트: 칸을 눌러 고치기(여러 칸 모아 한 번에 저장) · 줄 여러 개 골라 같은 값 넣기 · 할 일 묶음 · 줄 나누기·옮기기·지우기·문제 표시 · 재고 줄 추가
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
    tax_rate: '세율', handling: '처리 방식', ref: '근거', claim: '클레임', claim_at: '클레임 시각', order_id: '주문번호', line_id: '줄 id', product_id: '상품 id' };
  const STATES = ['후보', '정밀확인', '탈락', '외부대기', '끝'];
  let cur = { table: 'sheet_rows', q: '', where: {}, preset: '진행 중', offset: 0 }, last = null, sel = null, built = false;
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
    tools.append(q);
  }

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
          cur = { table: t.name, q: '', where: {}, preset: t.name === 'sheet_rows' ? '진행 중' : t.name === 'order_ledger' ? '미정' : '', offset: 0 };
          document.querySelector('.dt-q').value = ''; sel = null; detail(); loadTables(); load();
        };
        box.append(b);
      }
    } catch (e) { box.textContent = '표 목록을 불러오지 못했어요: ' + e.message; }
  }

  function chips(box, label, items, isOn, onPick, allOn, onAll) {
    const g = E('div', 'dt-facet'); g.append(E('span', 'muted small', label + ' '));
    const all = E('button', 'chipbtn' + (allOn ? ' on' : ''), '전체'); all.type = 'button'; all.setAttribute('aria-pressed', String(allOn)); all.onclick = onAll; g.append(all);
    for (const [v, n] of items) {
      const b = E('button', 'chipbtn' + (isOn(v) ? ' on' : ''), `${v == null || v === '' ? (label === '플랫폼' ? '재고·수동' : '(빈칸)') : v} ${n}`); b.type = 'button';
      b.setAttribute('aria-pressed', String(isOn(v))); b.onclick = () => onPick(v); g.append(b);
    }
    box.append(g);
  }

  async function load() {
    const wrap = document.querySelector('.dt-wrap'); if (!wrap) return;
    const ps = new URLSearchParams({ table: cur.table, q: cur.q, offset: cur.offset, limit: isSheet() ? 100 : 50, preset: cur.preset || '' });
    for (const [k, v] of Object.entries(cur.where)) ps.set('w_' + k, v);
    try { last = await fetchJ('/api/db/rows?' + ps.toString()); } catch (e) { wrap.textContent = '불러오지 못했어요: ' + e.message; return; }
    if (last.error) { wrap.textContent = last.error; return; }
    const pb = document.querySelector('.dt-presets'); pb.textContent = '';
    if ((last.presets || []).length) chips(pb, '할 일', last.presets, (v) => cur.preset === v, (v) => { cur.preset = v; cur.offset = 0; load(); }, !cur.preset, () => { cur.preset = ''; cur.offset = 0; load(); });
    const fb = document.querySelector('.dt-facets'); fb.textContent = '';
    for (const [f, vals] of Object.entries(last.facets || {})) {
      chips(fb, COLNAME[f] || f, vals, (v) => cur.where[f] === v, (v) => { cur.where[f] = v; cur.offset = 0; load(); }, !cur.where[f], () => { delete cur.where[f]; cur.offset = 0; load(); });
    }
    stockForm();
    render();
    const more = document.querySelector('.dt-more'); more.textContent = '';
    more.append(E('span', 'muted small', `${last.total.toLocaleString('ko-KR')}줄 중 ${last.total ? cur.offset + 1 : 0}–${cur.offset + last.rows.length}`));
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
  const sheetCol = (c) => (last.edit.cols || {})[c] || c;
  const ident = (r) => ({ 상품명: r.name || '', 공홈주문번호: r.shop_order || '', 수령인: r.receiver || '' });

  function render() {
    const wrap = document.querySelector('.dt-wrap'); wrap.textContent = '';
    const ed = isSheet() ? (last.edit || {}) : null;
    const tbl = E('table', 'dt' + (ed ? ' sheet' : '')); const thead = E('thead'); const tr = E('tr');
    if (ed) {
      const th = E('th', 'pick'); const all = E('input'); all.type = 'checkbox'; all.setAttribute('aria-label', '이 화면 줄 모두 고르기');
      all.checked = last.rows.length > 0 && last.rows.every((r) => picked.has(rid(r)));
      all.onchange = () => { for (const r of last.rows) all.checked ? picked.add(rid(r)) : picked.delete(rid(r)); render(); bar(); };
      th.append(all); tr.append(th);
    }
    for (const c of last.cols) { const th = E('th', null, COLNAME[c] || c); if (ed && canEdit(c, null)) th.classList.add('edh'); tr.append(th); }
    thead.append(tr); tbl.append(thead);
    const tb = E('tbody');
    for (const r of last.rows) {
      const row = E('tr'); row.tabIndex = 0;
      if (ed && r.problem) row.classList.add('prob');
      if (ed && (isStock(r) || String(r.progress || '').startsWith('재고'))) row.classList.add('stock');
      if (sel && ed && rid(sel) === rid(r)) row.classList.add('on');
      if (ed) {
        const td = E('td', 'pick'); const cb = E('input'); cb.type = 'checkbox'; cb.checked = picked.has(rid(r));
        cb.setAttribute('aria-label', `${r.tab} ${r.row}행 고르기`);
        cb.onclick = (e) => e.stopPropagation();
        cb.onchange = () => { cb.checked ? picked.add(rid(r)) : picked.delete(rid(r)); bar(); };
        td.append(cb); row.append(td);
      }
      for (const c of last.cols) {
        const td = E('td');
        const pk = ed && pending[`${rid(r)}:${c}`];
        const v = pk ? pk.new : fmt(c, r[c]);
        if (['state', 'status', 'handling', 'progress'].includes(c) && v) td.append(E('span', 'badge ' + badgeCls(v), v));
        else td.textContent = v.length > 60 ? v.slice(0, 59) + '…' : v;
        if (ed && canEdit(c, r)) {
          td.classList.add('ed'); td.title = '눌러서 고치기';
          if (pk) td.classList.add('dirty');
          td.onclick = (e) => { e.stopPropagation(); cellEdit(td, r, c); };
        }
        row.append(td);
      }
      const open = () => { sel = r; detail(); document.querySelectorAll('.dt tbody tr').forEach((x) => x.classList.remove('on')); row.classList.add('on'); };
      row.onclick = open; row.onkeydown = (e) => { if (e.key === 'Enter' && e.target === row) open(); };
      tb.append(row);
    }
    if (!last.rows.length) { const e = E('tr'); const td = E('td', 'empty', '맞는 줄이 없어요'); td.colSpan = last.cols.length + (ed ? 1 : 0); e.append(td); tb.append(e); }
    tbl.append(tb); wrap.append(tbl);
  }

  function stage(r, c, val) {
    const k = `${rid(r)}:${c}`, old = r[c] == null ? '' : String(r[c]);
    if (val === old) delete pending[k];
    else pending[k] = { tab: r.tab, row: r.row, key: r.key, col: sheetCol(c), old, new: val, ident: ident(r) };
  }

  function cellEdit(td, r, c) {
    if (td.querySelector('input,select')) return;
    const k = `${rid(r)}:${c}`, now = pending[k] ? pending[k].new : (r[c] == null ? '' : String(r[c]));
    let el;
    if (c === 'ship_mode') { el = E('select'); for (const o of ['', ...last.edit.methods]) { const x = E('option', null, o || '(비움)'); x.value = o; if (o === now) x.selected = true; el.append(x); } }
    else { el = E('input'); el.value = now; }
    el.className = 'cell-in'; el.setAttribute('aria-label', `${r.tab} ${r.row}행 ${COLNAME[c] || c}`);
    td.textContent = ''; td.append(el); el.focus(); if (el.select) el.select();
    let done = false;
    const finish = (save, then) => { if (done) return; done = true; if (save) stage(r, c, el.value.trim()); render(); bar(); if (then) then(); };
    el.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') finish(false);
      else if (e.key === 'Tab') { e.preventDefault(); finish(true, () => nextCell(r, c, e.shiftKey ? -1 : 1)); }
    };
    el.onblur = () => finish(true);
    if (c === 'ship_mode') el.onchange = () => finish(true);
    el.onclick = (e) => e.stopPropagation();
  }
  function nextCell(r, c, dir) {      // Tab = 옆의 고칠 수 있는 칸으로(시트처럼)
    const cols = last.cols.filter((x) => canEdit(x, r)); const i = cols.indexOf(c) + dir;
    if (i < 0 || i >= cols.length) return;
    const tr = document.querySelectorAll('.dt tbody tr')[last.rows.indexOf(r)];
    const td = tr && tr.children[last.cols.indexOf(cols[i]) + 1];
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
      go.onclick = () => { for (const r of last.rows.filter((x) => picked.has(rid(x)))) stage(r, s.value, v.value.trim()); render(); bar(); };
      const clr = E('button', 'btn sm ghost', '고르기 풀기'); clr.type = 'button'; clr.onclick = () => { picked.clear(); render(); bar(); };
      g.append(E('b', null, `${m}줄 고름`), s, v, go, clr); b.append(g);
    }
    if (n) {
      const g = E('div', 'dt-bar-g');
      const undo = E('button', 'btn sm ghost', '되돌리기'); undo.type = 'button'; undo.onclick = () => { pending = {}; render(); bar(); };
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
      const j = await post({ kind: 'sheet_edit', edits, force });
      if (/회차가 시트를 쓰는 중/.test(j.msg)) { bar(); alertBar('⚠ ' + j.msg, true); return; }
      const failed = new Set((j.msg.match(/• \S+ \d+행 [^:]+:/g) || []).map((s) => s.slice(2, -1)));
      for (const [k, e] of Object.entries(pending)) if (!failed.has(`${e.tab} ${e.row}행 ${e.col}`)) delete pending[k];
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
  const tabsOf = () => ((last.facets || {}).tab || []).map((x) => x[0]).filter(Boolean);

  // ── 재고 줄 추가(주문 시트 위) ──
  function stockForm() {
    const box = document.querySelector('.dt-stock'); if (!box) return; box.textContent = '';
    if (!isSheet()) return;
    const f = E('div', 'dt-acts'); f.hidden = true;
    const open = btn('＋ 재고 줄 추가', 'ghost', () => { f.hidden = !f.hidden; });
    const tab = select(tabsOf(), cur.where.tab), shop = inp('예: 아마존·츄위·공홈'), no = inp('공홈 주문번호'), price = inp('공홈가(외화)'), qty = inp('보낼수량', '1'),
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
    if (r.key && !isStock(r) && (isSheet() || ['orders', 'order_ledger'].includes(cur.table))) historyBox(box, r);
    box.scrollTop = 0; x.focus();
  }

  function sheetActs(r, acts, out) {
    const ordered = r.key && !isStock(r);
    // 칸 고치기(표에서 누르기 어려운 휴대폰용 — 같은 저장 길)
    const cols = (last.edit.editable || []).concat(isStock(r) ? last.edit.stock_only : []);
    const c = select(cols.map((x) => COLNAME[x] || x)), v = inp('새 값');
    const syncV = () => { const k = cols[c.selectedIndex]; v.value = r[k] == null ? '' : r[k]; }; c.onchange = syncV; syncV();
    acts.append(form('칸 고치기', field('칸', c), field('값', v), btn('시트에 저장', 'primary', (b) => {
      const k = cols[c.selectedIndex];
      doAct({ kind: 'sheet_edit', edits: [{ tab: r.tab, row: r.row, key: r.key, col: sheetCol(k), old: r[k] == null ? '' : String(r[k]), new: v.value.trim(), ident: ident(r) }] }, b, out);
    })));
    if (r.problem) acts.append(form('문제 줄', E('p', 'small', r.problem), btn('문제 풀기(빨간색 해제)', 'weak', (b) => doAct({ kind: 'sheet_row', op: 'unproblem', tab: r.tab, row: r.row }, b, out))));
    else {
      const pc = select(['해외송장', '국내송장', '공홈주문번호', '공홈가', '구매처', '훗타운신청번호', '배송방식', '수령인', '메모']), why = inp('무엇이 문제인지(근거)'), todo = inp('할 일');
      acts.append(form('문제 표시(빨간 줄 + #할-일 카드)', field('칸', pc), field('문제', why), field('할 일', todo),
        btn('문제로 표시', 'weak', (b) => doAct({ kind: 'sheet_row', op: 'problem', tab: r.tab, row: r.row, col: pc.value, why: why.value.trim(), todo: todo.value.trim() }, b, out))));
    }
    if (!ordered) { stockActs(r, acts, out); return; }
    const tot = +(r.send_qty || r.qty || 0) || 2;
    const keep = inp('이 줄 수량', String(Math.max(1, tot - 1))), mv = inp('새 줄 수량', '1');
    acts.append(form('줄 나누기(관세 US$150 등)', E('p', 'muted small', '같은 주문을 두 줄로 — 새 줄은 같은 탭 맨 아래, 송장·신청번호 칸은 비워요.'), field('이 줄 보낼수량', keep), field('새 줄 보낼수량', mv),
      btn('두 줄로 나누기', 'weak', (b) => doAct({ kind: 'sheet_row', op: 'split', tab: r.tab, row: r.row, key: r.key, keep: keep.value.trim(), move: mv.value.trim(),
        confirm: `${r.receiver} 주문을 ${keep.value}개 + ${mv.value}개 두 줄로 나눌까요?` }, b, out))));
    const to = select(tabsOf().filter((t) => t !== r.tab));
    acts.append(form('다른 탭으로 옮기기', E('p', 'muted small', '새 탭 맨 아래로 옮기고, 다음부터 이 상품은 그 탭으로 들어가요.'), field('옮길 탭', to),
      btn('옮기기', 'weak', (b) => doAct({ kind: 'sheet_row', op: 'move', tab: r.tab, row: r.row, key: r.key, to: to.value, confirm: `${r.receiver} 줄을 ${r.tab} → ${to.value} 탭으로 옮길까요?` }, b, out))));
    acts.append(form('줄 지우기', E('p', 'muted small', '지운 주문은 다시 자동으로 들어오지 않아요. 지운 줄은 통째로 백업해 둬요. 같은 주문의 나눈 줄인지 먼저 확인해 주세요.'),
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
    acts.append(form('다른 탭으로 옮기기', E('p', 'muted small', '새 탭 맨 아래로 옮겨요.'), field('옮길 탭', to),
      btn('옮기기', 'weak', (b) => doAct({ kind: 'sheet_row', op: 'move', tab: r.tab, row: r.row, key: '', ident: ident(r), to: to.value, confirm: `재고 '${name}' 줄을 ${r.tab} → ${to.value} 탭으로 옮길까요?` }, b, out))));
    acts.append(form('줄 지우기', E('p', 'muted small', '지운 줄은 통째로 백업해 둬요. 아직 쓰지 않은 재고인지 먼저 확인해 주세요.'),
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
  window.barunData = () => { build(); loadTables(); load(); };
  const pd = document.getElementById('p-data');      // 주소가 #data로 열렸으면 이 파일이 늦게 읽혀도 바로 그림
  if (pd && !pd.hidden) window.barunData();
})();
