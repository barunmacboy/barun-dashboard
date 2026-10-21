// 🗂 데이터 탭 — barun.db 표 찾아보기 + 행에서 바로 조치(2026-10-21 사장님: "디비도 현황판에서 접근하고 어떤 액션이든 바로").
// 읽기: GET /api/db/tables · /api/db/rows?table=&q=&w_<칸>=&offset= (dashboard/dbview.py, 읽기 전용)
// 조치: POST /api/action {action:"db", kind, ...} → notify/actions.py (디스코드 승인 카드와 같은 조치 · 누른 사람 이름으로 일지)
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const fetchJ = async (p, opts) => (await (window.barunFetch || fetch)(p, opts)).json();
  const COLNAME = { lead_id: '줄', title: '상품', quantity: '수량', state: '상태', profit: '예상이익', cost_krw: '도착원가', market_krw: '시장가', plan: '계획가',
    marks: '표시', reason: '판정 이유', waiting: '대기', updated: '고친 시각', source_key: '원천', country: '나라', site: '판매처', currency: '통화', unit_price: '단가', fx_krw: '환율',
    checked_at: '확인', status: '상태', notes: '메모', platform: '플랫폼', listing_id: 'id', name: '이름', qty: '수량', price: '가격', seller_code: '판매자 코드',
    group_no: '그룹·상품', at: '시각', action: '동작', applied: '실행', ok: '성공', summary: '요약', approved_by: '승인', tab: '탭', row: '행', receiver: '받는 분',
    option: '옵션', progress: '진행', intl_tracking: '해외송장', kr_invoice: '국내송장', fwd_request: '배대지 신청', memo: '메모', problem: '문제', key: 'key',
    ordered_at: '주문일', claim_status: '클레임', paid: '결제', courier: '택배사', invoice: '송장', src: '출처', field: '칸', old: '전', new: '후' };
  const SHEET_COLS = ['국내송장', '해외송장', '해외운송사', '메모', '공홈주문번호', '공홈가'];
  const STATES = ['후보', '정밀확인', '탈락', '외부대기', '끝'];
  let cur = { table: 'sourcing_leads', q: '', where: {}, offset: 0 }, last = null, sel = null, built = false;

  const fmt = (k, v) => {
    if (v == null || v === '') return '';
    if (['profit', 'cost_krw', 'market_krw', 'price'].includes(k) && !isNaN(+v)) return (+v).toLocaleString('ko-KR') + '원';
    if (typeof v === 'string' && v.startsWith('[') || typeof v === 'string' && v.startsWith('{')) { try { const j = JSON.parse(v); return Array.isArray(j) ? j.join(', ') : Object.entries(j).map(([a, b]) => `${a === 'naver' ? '네이버' : a === 'coupang' ? '쿠팡' : a} ${typeof b === 'number' ? b.toLocaleString('ko-KR') : (typeof b === 'object' ? JSON.stringify(b) : b)}`).join(' · '); } catch (e) { /* 그대로 */ } }
    if (/^\d{4}-\d\d-\d\dT/.test(String(v))) return String(v).slice(5, 16).replace('T', ' ');
    return String(v);
  };
  const badgeCls = (v) => /탈락|반려|실패|SUSPENSION|PROHIBITION|CANCEL/.test(v) ? 'bad' : /정밀확인|등록준비|대기|심사|OUTOFSTOCK/.test(v) ? 'warn' : /등록|승인완료|SALE|ok|끝/.test(v) ? 'ok' : '';

  function build() {
    const root = $('p-data'); if (!root || built) return; built = true;
    root.innerHTML = '';
    const card = E('div', 'card');
    const h = E('div', 'card-h'); h.append(E('h2', null, '데이터'), E('span', 'desc', '전용 장부(barun.db)의 표예요. 줄을 누르면 자세히 보고 바로 조치할 수 있어요 — 바꾸는 일은 누른 사람 이름으로 일지에 남아요.'));
    card.append(h, E('div', 'dt-tables', null), E('div', 'dt-tools', null), E('div', 'dt-facets', null), E('div', 'dt-wrap', null), E('div', 'dt-more', null));
    root.append(card, Object.assign(E('div', 'card dt-detail'), { id: 'dt-detail', hidden: true }));
    const tools = card.querySelector('.dt-tools');
    const q = E('input', 'dt-q'); q.type = 'search'; q.placeholder = '찾기 — 이름·줄 번호·송장·코드'; q.setAttribute('aria-label', '찾기');
    let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { cur.q = q.value.trim(); cur.offset = 0; load(); }, 300); };
    tools.append(q);
  }

  async function loadTables() {
    const box = document.querySelector('.dt-tables'); if (!box) return;
    try {
      const ts = await fetchJ('/api/db/tables');
      box.textContent = '';
      for (const t of ts) {
        const b = E('button', 'tab' + (t.name === cur.table ? '' : ''), null); b.type = 'button';
        b.setAttribute('aria-selected', String(t.name === cur.table));
        b.append(document.createTextNode(t.label), E('span', 'dt-n', t.count.toLocaleString('ko-KR')));
        b.onclick = () => { cur = { table: t.name, q: '', where: {}, offset: 0 }; document.querySelector('.dt-q').value = ''; sel = null; loadTables(); load(); };
        box.append(b);
      }
    } catch (e) { box.textContent = '표 목록을 불러오지 못했어요: ' + e.message; }
  }

  async function load() {
    const wrap = document.querySelector('.dt-wrap'); if (!wrap) return;
    const ps = new URLSearchParams({ table: cur.table, q: cur.q, offset: cur.offset, limit: 50 });
    for (const [k, v] of Object.entries(cur.where)) ps.set('w_' + k, v);
    try { last = await fetchJ('/api/db/rows?' + ps.toString()); } catch (e) { wrap.textContent = '불러오지 못했어요: ' + e.message; return; }
    if (last.error) { wrap.textContent = last.error; return; }
    // 필터 칩(상태별 수)
    const fb = document.querySelector('.dt-facets'); fb.textContent = '';
    for (const [f, vals] of Object.entries(last.facets || {})) {
      const g = E('div', 'dt-facet');
      g.append(E('span', 'muted small', (COLNAME[f] || f) + ' '));
      const all = E('button', 'chipbtn' + (cur.where[f] ? '' : ' on'), '전체'); all.type = 'button';
      all.onclick = () => { delete cur.where[f]; cur.offset = 0; load(); }; g.append(all);
      for (const [v, n] of vals) {
        const b = E('button', 'chipbtn' + (cur.where[f] === v ? ' on' : ''), `${v ?? '(빈칸)'} ${n}`); b.type = 'button';
        b.onclick = () => { cur.where[f] = v; cur.offset = 0; load(); }; g.append(b);
      }
      fb.append(g);
    }
    wrap.textContent = '';
    const tbl = E('table', 'dt'); const thead = E('thead'); const tr = E('tr');
    for (const c of last.cols) tr.append(E('th', null, COLNAME[c] || c));
    thead.append(tr); tbl.append(thead);
    const tb = E('tbody');
    for (const r of last.rows) {
      const row = E('tr'); row.tabIndex = 0;
      for (const c of last.cols) {
        const td = E('td'); const v = fmt(c, r[c]);
        if (['state', 'status'].includes(c) && v) td.append(E('span', 'badge ' + badgeCls(v), v)); else td.textContent = v.length > 80 ? v.slice(0, 79) + '…' : v;
        row.append(td);
      }
      const open = () => { sel = r; detail(); document.querySelectorAll('.dt tbody tr').forEach((x) => x.classList.remove('on')); row.classList.add('on'); };
      row.onclick = open; row.onkeydown = (e) => { if (e.key === 'Enter') open(); };
      tb.append(row);
    }
    if (!last.rows.length) { const e = E('tr'); const td = E('td', 'empty', '맞는 줄이 없어요'); td.colSpan = last.cols.length; e.append(td); tb.append(e); }
    tbl.append(tb); wrap.append(tbl);
    const more = document.querySelector('.dt-more'); more.textContent = '';
    more.append(E('span', 'muted small', `${last.total.toLocaleString('ko-KR')}줄 중 ${cur.offset + 1}–${cur.offset + last.rows.length}`));
    if (cur.offset > 0) { const b = E('button', 'btn sm ghost', '‹ 앞'); b.type = 'button'; b.onclick = () => { cur.offset = Math.max(0, cur.offset - 50); load(); }; more.append(b); }
    if (cur.offset + last.rows.length < last.total) { const b = E('button', 'btn sm ghost', '다음 ›'); b.type = 'button'; b.onclick = () => { cur.offset += 50; load(); }; more.append(b); }
  }

  async function doAct(payload, btn, out) {
    if (payload.confirm && !confirm(payload.confirm)) return;
    delete payload.confirm;
    if (btn) btn.disabled = true;
    try {
      const r = await (window.barunFetch || fetch)('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ action: 'db' }, payload)) });
      const j = await r.json();
      if (out) { out.textContent = (j.ok ? '✅ ' : '⚠ ') + j.msg; out.hidden = false; }
      if (j.ok && !payload.kind.endsWith('preview')) { load(); loadTables(); }
      return j;
    } catch (e) { if (out) { out.textContent = '⚠ ' + e.message; out.hidden = false; } } finally { if (btn) btn.disabled = false; }
  }

  const field = (lab, input) => { const l = E('label', 'dt-field'); l.append(E('span', null, lab), input); return l; };
  const inp = (ph, val) => { const i = E('input'); i.placeholder = ph || ''; if (val != null) i.value = val; return i; };
  const select = (opts, val) => { const s = E('select'); for (const o of opts) { const x = E('option', null, o); x.value = o; if (o === val) x.selected = true; s.append(x); } return s; };

  function detail() {
    const box = $('dt-detail'); if (!box) return;
    box.hidden = !sel; box.textContent = ''; if (!sel) return;
    const r = sel;
    const head = E('div', 'od-head'); const tt = E('div', 'od-title');
    tt.append(E('div', 'od-name', r.title || r.name || r.receiver || r.key || r.lead_id || r.source_key || '줄'), E('div', 'od-role', `${last.label} · ${r.lead_id || r.key || r.listing_id || r.source_key || ''}`));
    const x = E('button', 'icon-btn', '✕'); x.type = 'button'; x.setAttribute('aria-label', '닫기'); x.onclick = () => { sel = null; detail(); };
    head.append(tt, x); box.append(head);
    const dl = E('dl', 'kv');
    for (const [k, v] of Object.entries(r)) { if (v == null || v === '') continue; dl.append(E('dt', null, COLNAME[k] || k)); const dd = E('dd'); dd.append(E('pre', null, fmt(k, v))); dl.append(dd); }
    box.append(dl);
    const out = E('div', 'what'); out.hidden = true;
    const acts = E('div', 'dt-acts');
    const A = last.actions || [];
    if (A.includes('state')) {
      const s = select(STATES, r.state), m = inp('왜 바꾸는지(일지에 남아요)');
      const b = E('button', 'btn sm weak', '상태 바꾸기'); b.type = 'button';
      b.onclick = () => doAct({ kind: 'sourcing_state', lead_id: r.lead_id, state: s.value, memo: m.value }, b, out);
      const g = E('div', 'dt-form'); g.append(E('div', 'od-t', '상태'), field('새 상태', s), field('메모', m), b); acts.append(g);
    }
    if (A.includes('recheck')) {
      const c = inp('도착원가(원)', r.cost_krw), n = inp('네이버 최저가(원, 없으면 -)'), cp = inp('쿠팡 최저가(원, 없으면 -)'), m = inp('근거 한 줄(어디서 언제 봤는지)');
      const b = E('button', 'btn sm weak', '다시 판정'); b.type = 'button';
      b.onclick = () => doAct({ kind: 'recheck', lead_id: r.lead_id, cost: c.value, naver: n.value, coupang: cp.value, memo: m.value }, b, out);
      const g = E('div', 'dt-form'); g.append(E('div', 'od-t', '원가·시장가 재확인'), field('도착원가', c), field('네이버 최저', n), field('쿠팡 최저', cp), field('근거', m), b); acts.append(g);
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
      const pv = E('button', 'btn sm', '미리보기'); pv.type = 'button';
      pv.onclick = () => doAct({ kind: 'register_preview', args: args() }, pv, out);
      const go = E('button', 'btn sm primary', '등록 실행'); go.type = 'button';
      go.onclick = () => doAct({ kind: 'register', args: args(), confirm: `${how.value === '네이버옵션' ? '네이버' : '쿠팡'}에 ${q.value}개 ${(+p.value).toLocaleString('ko-KR')}원으로 실제 등록할까요? 미리보기에서 막힌 것이 없었는지 확인해 주세요.` }, go, out);
      const g = E('div', 'dt-form'); g.append(E('div', 'od-t', '등록(공용 등록 도구)'), field('방식', how), field('그룹·상품 번호', id), field('수량', q), field('판매가', p), field('기준', base));
      const bs = E('div', 'btns'); bs.append(pv, go); g.append(bs); acts.append(g);
    }
    if (A.includes('sheet_set') && r.tab && r.row) {
      const c = select(SHEET_COLS), v = inp('새 값');
      const b = E('button', 'btn sm weak', '시트에 쓰기'); b.type = 'button';
      b.onclick = () => doAct({ kind: 'sheet_set', tab: r.tab, row: r.row, col: c.value, value: v.value.trim(), key: r.key,
        confirm: `시트 ${r.tab} ${r.row}행(${r.receiver || ''}) ${c.value}을 '${v.value.trim()}'(으)로 바꿀까요?` }, b, out);
      const g = E('div', 'dt-form'); g.append(E('div', 'od-t', '시트 칸 고치기'), field('칸', c), field('값', v), b); acts.append(g);
    }
    if (acts.childNodes.length) box.append(acts, out); else box.append(E('p', 'muted small', '이 표는 보기만 해요 — 바꿀 일은 #작업판에 말로 맡겨 주세요.'));
    if (window.innerWidth < 760) box.scrollIntoView({ block: 'start' });
  }

  window.barunData = () => { build(); loadTables(); load(); };
  const pd = document.getElementById('p-data');      // 주소가 #data로 열렸으면 이 파일이 늦게 읽혀도 바로 그림
  if (pd && !pd.hidden) window.barunData();
})();
