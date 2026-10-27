// 소싱 화면 — 소싱 장부 진행을 실시간으로(2026-10-21 사장님: "소싱 작업 현황도 실시간으로 현황판과 디스코드에서 볼 수 있게").
// 읽기: GET /api/sourcing (dashboard/sourcing.py, 읽기 전용) — 탭이 보일 때 15초마다 다시 읽음. 줄 상태 바꾸기는 주문 데이터 화면(소싱 장부)에서.
// 자리: index.html에 미리 있는 #p-sourcing을 채운다(보임·숨김은 'barun:page' 이벤트).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const won = (v) => v == null || v === '' ? '—' : Math.round(+v).toLocaleString('ko-KR') + '원';
  const hm = (iso) => !iso ? '' : String(iso).slice(5, 16).replace('T', ' ').replace('-', '/');
  // 상태 → 색(역할로): 등록=좋음, 외부대기=주의, 정밀확인=진행, 탈락=닫힘(회색), 후보=아직
  const ST = { 후보: ['var(--axis)', ''], 정밀확인: ['var(--st-run)', 'run'], 등록: ['var(--st-good)', 'ok'], 끝: ['var(--green-ink)', 'ok'],
    탈락: ['var(--muted)', ''], 외부대기: ['var(--st-warn)', 'warn'] };
  // 외부대기가 기다리는 것(dashboard/sourcing.py _wait_kind) — 2026-10-25: 28줄을 모두 '답 기다림'으로 보이던 것
  const WAIT = { 외부: '외부 답 기다림', 사장님: '사장님 결정 기다림', 구매처: '구매처 없음' };
  const waits = (w) => Object.entries(w || {}).filter(([, n]) => n).map(([k, n]) => `${WAIT[k] || k} ${n}`).join(' · ');
  // 소싱 기계(2026-10-26) 찾는 곳 이름(pricing/sourcing_ledger.METHODS + 400행·사람) · 쇼핑몰
  const SRC = { 우리판매: '우리 판매', 경쟁점: '경쟁 판매점', 순위: '해외직구 순위', 문의: '고객 문의', '400행': '400행 조사', 사람: '사람이 직접' };
  const PLN = { naver: '네이버', coupang: '쿠팡' };
  const num = (v) => v == null ? '—' : String(v);
  let timer = 0, busy = false;

  function install() {
    const sec = $('p-sourcing'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      .sc-bar { display: flex; height: 28px; border-radius: 8px; overflow: hidden; gap: 2px; background: var(--card); margin: 4px 0 8px; }
      .sc-bar > span { display: block; min-width: 3px; }
      .sc-leg { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 13px; color: var(--sub); }
      .sc-leg i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
      .sc-week { display: flex; align-items: flex-end; gap: 6px; height: 70px; margin-top: 6px; }
      .sc-week > div { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; font-size: 11px; color: var(--muted); }
      .sc-week b { display: block; width: 100%; max-width: 28px; background: var(--st-run); border-radius: 4px 4px 0 0; min-height: 2px; }
      .sc-feed li { padding: 10px 2px; display: flex; gap: 10px; align-items: flex-start; }
      .sc-feed .t { color: var(--muted); font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; min-width: 72px; padding-top: 2px; }
      .sc-feed .b { flex: 1; min-width: 0; } .sc-feed .m { color: var(--sub); font-size: 13px; }
      .sc-steps { margin: 8px 0 0; padding: 10px 12px; background: var(--fill2); border-radius: var(--r-sm); font-size: 13px; color: var(--sub); }
      .sc-steps div + div { margin-top: 4px; }
      @media (max-width: 720px) { #sc-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      .sc-sub { margin: 16px 0 6px; font-weight: 700; font-size: 14px; }
      .sc-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .sc-tbl { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
      .sc-tbl th { text-align: left; color: var(--muted); font-weight: 600; font-size: 12px; padding: 6px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
      .sc-tbl td { padding: 8px; border-bottom: 1px solid var(--line); white-space: nowrap; vertical-align: top; }
      .sc-tbl .n { text-align: right; } .sc-tbl td.t { white-space: normal; min-width: 150px; max-width: 320px; }
      .sc-tbl a { color: inherit; text-decoration: underline; text-decoration-color: var(--axis); text-underline-offset: 2px; }
      .sc-share { display: grid; grid-template-columns: 104px 1fr; gap: 2px 10px; align-items: center; font-size: 13px; margin: 8px 0; }
      .sc-share .bar { height: 10px; border-radius: 5px; background: var(--fill2); overflow: hidden; }
      .sc-share .bar b { display: block; height: 100%; background: var(--st-run); border-radius: 5px; }
      .sc-share .m { grid-column: 2; color: var(--muted); font-size: 12px; }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero"><h2 id="sc-title">불러오는 중</h2><p class="lead" id="sc-lead"></p><div class="stats" id="sc-stats"></div></div>
      <div class="card" id="sc-m" hidden><div class="card-h"><h2>소싱 기계</h2><span class="desc" id="sc-m-desc">찾기 → 거르기 → 올리기 → 팔리나</span></div>
        <div class="stats" id="sc-m-stats"></div>
        <div class="sc-sub">찾는 곳별 흐름</div><div class="sc-scroll"><table class="sc-tbl" id="sc-m-funnel"></table></div>
        <div class="sc-sub">찾는 곳 점수 <span class="muted small" id="sc-m-wdesc"></span></div><div id="sc-m-score"></div>
        <div class="sc-sub">올린 상품 성과 <span class="muted small" id="sc-m-pdesc"></span></div><div class="sc-scroll"><table class="sc-tbl" id="sc-m-perf"></table></div></div>
      <div class="card"><div class="card-h"><h2>장부 400줄 어디까지 왔나</h2><span class="desc" id="sc-bar-desc">끝·탈락·외부대기가 닫힌 줄</span></div>
        <div class="sc-bar" id="sc-bar" role="img"></div><div class="sc-leg" id="sc-leg"></div></div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>⑨ 소싱 회차</h2><span class="act" id="sc-run-badge"></span></div><div id="sc-run"></div></div>
        <div class="card"><div class="card-h"><h2>최근 7일 새로 닫은 줄</h2><span class="desc">상태가 닫힘으로 바뀐 줄 · 하루 목표 10줄</span></div><div class="sc-week" id="sc-week"></div></div>
      </div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>등록 준비</h2><span class="act" id="sc-ap"></span></div><ul class="list" id="sc-ready"></ul></div>
        <div class="card"><div class="card-h"><h2>외부 대기</h2><span class="desc" id="sc-wait-desc">답·결정·조건을 기다리는 줄</span></div><ul class="list" id="sc-wait"></ul></div>
      </div>
      <div class="card"><div class="card-h"><h2>방금 바뀐 줄</h2><span class="desc">상태 수정은 주문 데이터 → 소싱 장부</span></div><ul class="list sc-feed" id="sc-feed"></ul></div>
      <div class="card"><div class="card-h"><h2>다음 차례 10줄</h2></div><ul class="list" id="sc-next"></ul></div>
      <div class="card"><div class="card-h"><h2>원가 빈 판매 상품</h2><span class="desc" id="sc-gap-at">팔린 순 · 원가는 #할-일 카드 답글로</span></div><ul class="list" id="sc-gap"></ul></div>`;
    // 보임·숨김은 index.html이 'barun:page'로 알려 줌(2026-10-22 리뉴얼 — 탭 덧붙이기·showTab 덮어쓰기 없앰)
    document.addEventListener('barun:page', (e) => { if (e.detail === 'sourcing') { load(); start(); } else stop(); });
    if (!sec.hidden) { load(); start(); }
    return true;
  }

  const start = () => { stop(); timer = setInterval(() => { if (!document.hidden && !$('p-sourcing').hidden) load(); }, 15000); };
  const stop = () => { if (timer) clearInterval(timer); timer = 0; };

  function li(title, sub, badge, cls) {
    const l = E('li'); const r = E('div', 'row'); r.style.cursor = 'default';
    const b = E('div', 'row-body'); b.append(E('span', null, title)); if (sub) b.append(E('span', 'muted small', sub));
    r.append(b); if (badge) r.append(E('span', 'badge ' + (cls || ''), badge)); l.append(r); return l;
  }
  const empty = (ul, t) => { ul.innerHTML = ''; ul.append(E('li', 'muted small', t)); };
  const stat = (k, v, d, cls) => { const s = E('div', 'stat ' + (cls || '')); s.style.cursor = 'default'; s.append(E('div', 'k', k), E('div', 'v', v), E('div', 'd', d || '')); return s; };

  // 표 한 줄 — vals: 글자 또는 요소, nums: 오른쪽 맞춤할 칸 번호
  function trow(tag, vals, nums = []) {
    const tr = E('tr');
    vals.forEach((v, i) => { const c = E(tag, nums.includes(i) ? 'n' : null); if (v instanceof Object && v.append) c.append(v); else c.textContent = v == null ? '' : String(v); tr.append(c); });
    return tr;
  }
  const ext = (t, url) => { if (!url) return E('span', null, t); const a = E('a', null, t); a.href = url; a.target = '_blank'; a.rel = 'noopener'; return a; };

  // 소싱 기계(2026-10-26 사장님 "소싱 작업의 대 혁신") — pricing/performance.summary: 깔때기 · 오늘 자동 등록 몫 · 출처 점수 · 올린 상품 성과
  function machine(m) {
    const box = $('sc-m'); if (!box) return;
    box.hidden = !m;
    if (!m) return;
    if (m.error) { $('sc-m-desc').textContent = '못 읽었어요 — ' + m.error; return; }
    const a = m.auto || {}, cf = m.conf || {}, W = cf.watch || 14, S = cf.stop || 30, WIN = cf.window || 30;
    const stale = m.stale || [], watch = m.watch || [];
    $('sc-m-desc').textContent = '찾기 → 거르기 → 올리기 → 팔리나';
    const st = $('sc-m-stats'); st.innerHTML = '';
    st.append(stat('오늘 자동 등록', `${a.today || 0}/${a.max || 0}`, a.on ? '조건 통과 줄은 바로 올림' : '자동 등록 꺼짐', a.today ? 'ok' : ''),
      stat('오늘 새로 찾음', `${m.found_today || 0}`, '네 곳에서 찾은 후보', ''),
      stat('올린 상품', `${m.total || 0}`, `팔린 것 ${m.sold || 0} · 주문 ${m.orders || 0}건`, m.sold ? 'ok' : ''),
      stat(`${W}일째 주문 0`, `${watch.length}`, '지켜보는 중', watch.length ? 'warn' : ''),
      stat(`${S}일 동안 안 팔림`, `${stale.length}`, stale.length ? '#할-일에 정리 제안' : '없음', stale.length ? 'warn' : ''));
    if (m.unlinked) st.append(stat('못 이음', `${m.unlinked}`, '판매 목록에서 못 찾음', 'bad'));
    // ① 찾는 곳별 흐름(400행 조사·사람이 직접 올린 것도 같이)
    const fu = $('sc-m-funnel'); fu.innerHTML = '';
    fu.append(trow('th', ['찾는 곳', '찾음', '거르기 통과', '탈락', '올림', `${W}일 안에 팔림`], [1, 2, 3, 4, 5]));
    for (const f of m.funnel || []) fu.append(trow('td', [SRC[f.source] || f.source, num(f.found), num(f.passed), num(f.dropped), num(f.registered), num(f.sold14)], [1, 2, 3, 4, 5]));
    // ④ 찾는 곳 점수 — 하루 찾을 몫(weights, 없으면 설정값)
    const sc = $('sc-m-score'); sc.innerHTML = '';
    $('sc-m-wdesc').textContent = m.weights ? '· 하루 찾을 몫을 이 비율로 나눠요' : '· 아직 자료 부족(올린 줄 3개 미만) — 하루 몫은 설정값으로';
    for (const s of m.scores || []) {
      const share = s.method ? (s.share != null ? s.share : s.quota) : null;
      const row = E('div', 'sc-share'), bar = E('div', 'bar'), b = E('b');
      b.style.width = share != null ? `${Math.round(share * 100)}%` : '0%'; bar.append(b);
      const desc = [s.method ? `하루 몫 ${Math.round((share || 0) * 100)}%${s.share != null && s.enough ? '' : '(설정값)'}` : '하루 몫 없음',
        `올림 ${s.n}줄 · ${WIN}일 주문 ${s.orders30}건`, s.rate != null ? `${WIN}일 환산 1줄당 ${s.rate}건` : ''].filter(Boolean).join(' · ');
      row.append(E('span', null, SRC[s.source] || s.source), bar, E('span', 'm', desc)); sc.append(row);
    }
    if (m.top) sc.append(E('div', 'muted small', `${WIN}일 판매 1위: ${SRC[m.top.source] || m.top.source} · 환산 = 올린 지 ${WIN}일이 안 된 줄은 지난 날수로 나눠 ${WIN}일로 맞춤`));
    // ③ 올린 상품 성과 — 새로 올린 순
    const key = (r) => `${r.platform}:${r.lead_id}`;
    const ss = new Set(stale.map(key)), ws = new Set(watch.map(key));
    $('sc-m-pdesc').textContent = `· 새로 올린 순 · 취소·반품 뺌${m.more ? ` · 외 ${m.more}개` : ''}`;
    const pf = $('sc-m-perf'); pf.innerHTML = '';
    pf.append(trow('th', ['올린 날', '상품', '쇼핑몰', '찾은 곳', '자동', `${W}일`, `${WIN}일`, '상태'], [5, 6]));
    for (const r of m.rows || []) {
      const t = E('span'); t.append(ext(r.title, r.link || r.wing)); if (r.pid) t.append(E('span', 'muted small', ` ${r.pid}`));
      const cls = !r.linked ? 'bad' : ss.has(key(r)) || ws.has(key(r)) ? 'warn' : r.selling ? 'ok' : 'run';
      const word = ss.has(key(r)) ? `${S}일 안 팔림` : ws.has(key(r)) ? `${W}일째 0` : r.status;
      const tr = trow('td', [hm(r.at).slice(0, 5), t, PLN[r.platform] || r.platform, SRC[r.source] || r.source, r.auto ? '자동' : '',
        r.days < W ? `${r.o14} · ${r.days}일째` : `${r.o14}`, `${r.o30}`, E('span', 'badge ' + cls, word)], [5, 6]);
      tr.children[1].className = 't';
      if (r.orders) tr.title = `주문 ${r.orders}건 · 매출 ${won(r.sales)}${r.canceled ? ` · 취소·반품 ${r.canceled}건 뺌` : ''}`;
      pf.append(tr);
    }
    if (!(m.rows || []).length) { const tr = E('tr'), td = E('td', 'muted small', '아직 소싱으로 올린 상품이 없어요'); td.colSpan = 8; tr.append(td); pf.append(tr); }
  }
  window.barunSourcingMachine = machine;     // 시험(dashboard/tests/test_sourcing.py)이 브라우저 없이 부름

  function render(d) {
    try { machine(d.machine); } catch (e) { console.error('소싱 기계 칸', e); }    // 이 칸이 깨져도 아래 400행 화면은 그대로
    const c = d.counts, ap = d.approval || {}, run = d.run || {}, t = d.today || {}, act = run.activity || {}, reg = d.registered || {}, man = d.manual || {};
    const pct = Math.round(d.closed / Math.max(1, d.total) * 100);
    $('sc-title').textContent = run.running ? '⑨ 소싱 회차 진행 중' : `장부 ${d.total}줄 중 ${d.closed}줄 닫음 · ${pct}%`;
    // 2026-10-25: '오늘 처리'가 재확인 메모만 남긴 줄까지 셌음 → 상태가 실제로 바뀐 줄과 재확인을 따로
    $('sc-lead').textContent = `오늘 상태 바뀐 줄 ${t.n}(재확인 ${t.recheck || 0}) · 남은 후보 ${d.open}(원가 근거 없음 ${d.nocost}) · 등록 준비 ${d.ready.length}줄` +
      (ap.status === 'pending' ? ' — 사장님 승인 기다림' : ap.status === 'approved' ? ' — 승인됨, 다음 회차가 등록' : '');
    $('sc-bar-desc').textContent = '끝·탈락·외부대기가 닫힌 줄' + (man.n ? ` · 400행 밖 수동 ${man.n}줄은 빼고 셈` : '');
    const st = $('sc-stats'); st.innerHTML = '';
    st.append(stat('오늘 상태 바뀐 줄', `${t.n}`, [Object.entries(t.by || {}).map(([k, v]) => `${k} ${v}`).join(' · '), t.recheck ? `재확인 ${t.recheck}` : ''].filter(Boolean).join(' · ') || `목표 ${t.target}줄`, t.n ? 'run' : ''),
      stat('등록한 조사 줄', `${c['등록'] || 0}`, reg.products != null ? `같은 물건 묶으면 ${reg.products}개` : '', ''),
      stat('등록 준비', `${d.ready.length}`, ap.status === 'pending' ? '승인 대기' : ap.status === 'approved' ? '승인됨' : '', d.ready.length ? 'warn' : ''),
      stat('남은 후보', `${d.open}`, `정밀확인 ${c['정밀확인'] || 0}`, ''), stat('외부 대기', `${c['외부대기'] || 0}`, waits(d.waits) || '답 기다림', c['외부대기'] ? 'warn' : ''),
      stat('탈락', `${c['탈락'] || 0}`, '이익·원가 기준 미달', ''));
    const gap = d.costgap;   // 2026-10-24 원가 원본(barun.db): 원가 빈 판매 상품 수(하루 1번)
    if (gap) st.append(stat('원가 빈 판매상품', `${gap.products}`, `옵션 ${gap.options} · 쿠팡 ${gap.coupang} · 네이버 ${gap.naver}`, gap.products ? 'warn' : ''));
    const ug = $('sc-gap'); ug.innerHTML = '';
    if (!gap) empty(ug, '아직 안 셈');
    else if (!gap.list.length) empty(ug, '없음');
    else {
      $('sc-gap-at').textContent = `${hm(gap.at)} 기준 · 팔린 순 · 원가는 #할-일 카드 답글로`;
      for (const g of gap.list) ug.append(li(g.name, `${g.platform === 'coupang' ? '쿠팡' : '네이버'} · 옵션 ${g.n}개${g.orders ? ' · 주문 ' + g.orders + '건' : ''}`, '', ''));
      if (gap.products > gap.list.length) ug.append(E('li', 'muted small', `외 ${gap.products - gap.list.length}개`));
    }
    const bar = $('sc-bar'), leg = $('sc-leg'); bar.innerHTML = ''; leg.innerHTML = '';
    bar.setAttribute('aria-label', d.order.map((s) => `${s} ${c[s] || 0}`).join(', '));
    for (const s of d.order) {
      const n = c[s] || 0; if (!n) continue;
      const seg = E('span'); seg.style.flex = String(n); seg.style.background = ST[s][0]; seg.title = `${s} ${n}줄`; bar.append(seg);
      const l = E('span'); const i = E('i'); i.style.background = ST[s][0]; l.append(i, document.createTextNode(`${s} ${n}`)); leg.append(l);
    }
    const rb = $('sc-run-badge'); rb.innerHTML = '';
    rb.append(E('span', 'badge ' + (run.running || act.active ? 'run' : 'k-idle'), run.running ? '진행 중' : act.active ? '회차 밖 작업 중' : '쉬는 중'));
    const rr = $('sc-run'); rr.innerHTML = '';
    if (run.running) rr.append(E('div', null, `${hm(run.started)} 시작`));
    if (run.last) rr.append(E('div', 'muted small', `마지막 회차 ${hm(run.last.at)} ${run.last.verb}${run.last.rc && run.last.rc !== '0' ? ' (rc ' + run.last.rc + ')' : ''}`));
    else if (!run.running) rr.append(E('div', 'muted small', '아직 회차 없음'));
    if (run.next) rr.append(E('div', 'muted small', `다음 회차 ${hm(run.next)}`));
    // 2026-10-25: 작업판·Codex가 회차 밖에서 등록해도 '쉬는 중'만 보이던 것 → 장부·등록 기록의 마지막 시각을 같이
    if (act.ledger) rr.append(E('div', 'muted small', `장부 마지막 움직임 ${hm(act.ledger.at)} · ${act.ledger.title || act.ledger.lead_id}`));
    if (act.reg) rr.append(E('div', 'muted small', `마지막 등록 기록 ${hm(act.reg.at)} · ${act.reg.platform === 'naver' ? '네이버' : act.reg.platform === 'coupang' ? '쿠팡' : act.reg.platform || ''} ${act.reg.action || ''}${act.reg.ok ? '' : ' (실패)'}`));
    if (run.steps && run.steps.length) { const s = E('div', 'sc-steps'); for (const x of run.steps) s.append(E('div', null, window.noEmoji ? window.noEmoji(x) : x)); rr.append(s); }
    const wk = $('sc-week'); wk.innerHTML = ''; const mx = Math.max(10, ...d.week.map((w) => w.n));
    for (const w of d.week) { const col = E('div'); col.title = `${w.day} ${w.n}줄`; const b = E('b'); b.style.height = `${w.n / mx * 100}%`; col.append(E('span', null, String(w.n)), b, E('span', null, w.day.slice(5).replace('-', '/'))); wk.append(col); }
    const ap_ = $('sc-ap'); ap_.innerHTML = '';
    if (ap.status && ap.status !== 'none') ap_.append(E('span', 'badge ' + (ap.status === 'pending' ? 'warn' : ap.status === 'approved' ? 'ok' : 'bad'), { pending: '승인 대기', approved: '승인됨', rejected: '거절됨' }[ap.status] || ap.status));
    const ur = $('sc-ready'); ur.innerHTML = '';
    if (!d.ready.length) empty(ur, '없음');
    for (const r of d.ready) ur.append(li(`${r.title} · ${r.qty}개`, `계획가 ${Object.entries(r.plan || {}).map(([k, v]) => `${k === 'naver' ? '네이버' : '쿠팡'} ${won(v)}`).join(' · ')} · 원가 ${won(r.cost)} · 이익 ${won(r.profit)}`, r.lead_id, ''));
    const uw = $('sc-wait'); uw.innerHTML = '';
    $('sc-wait-desc').textContent = waits(d.waits) || '답·결정·조건을 기다리는 줄';
    if (!d.waiting.length) empty(uw, '없음');
    // 'n/n부터' = 외부대기로 들어온 날(이력) — 전엔 장부 동기화 시각이라 모두 오늘 날짜
    for (const r of d.waiting) uw.append(li(`${r.title} · ${r.qty}개`, `${WAIT[r.wait] ? WAIT[r.wait] + ' — ' : ''}${r.waiting || r.reason || ''}`, `${hm(r.since || r.updated).slice(0, 5)}부터`, r.wait === '사장님' ? 'warn' : ''));
    const uf = $('sc-feed'); uf.innerHTML = '';
    if (!d.recent.length) empty(uf, '없음');
    for (const h of d.recent) {
      const l = E('li'); const b = E('div', 'b');
      // 상태가 실제로 바뀐 이력만 그 상태 표시 — 재확인 메모('미등록'·'신규등록제외')가 '등록'으로 보이던 것(2026-10-25)
      const moved = h.changed !== false;
      const top = E('div'); top.append(E('span', 'badge ' + (moved ? (ST[h.state] || [, ''])[1] : ''), moved ? h.state : '재확인'),
        document.createTextNode(` ${h.title || h.lead_id}${h.qty ? ' · ' + h.qty + '개' : ''}${moved ? (h.prev ? ` · ${h.prev}에서` : '') : ` · 상태 그대로(${h.state})`}`));
      b.append(top, E('div', 'm', h.memo || '')); l.append(E('span', 't', hm(h.at)), b); uf.append(l);
    }
    const un = $('sc-next'); un.innerHTML = '';
    if (!d.next.length) empty(un, '열린 줄 없음');
    for (const r of d.next) un.append(li(`${r.title} · ${r.qty}개`, (r.marks || []).join(' · ') || (r.profit != null ? `예상 이익 ${won(r.profit)}` : ''), r.state, (ST[r.state] || [, ''])[1]));
  }

  async function load() {
    if (busy) return; busy = true;
    try { const r = await (window.barunFetch || fetch)('/api/sourcing'); if (r.ok) render(await r.json()); }
    catch (e) { /* 토큰 창은 barunFetch가 띄움 */ } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
