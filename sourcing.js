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
      @media (max-width: 720px) { #sc-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero"><h2 id="sc-title">불러오는 중</h2><p class="lead" id="sc-lead"></p><div class="stats" id="sc-stats"></div></div>
      <div class="card"><div class="card-h"><h2>장부 400줄 어디까지 왔나</h2><span class="desc">후보·정밀확인은 열린 줄</span></div>
        <div class="sc-bar" id="sc-bar" role="img"></div><div class="sc-leg" id="sc-leg"></div></div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>⑨ 소싱 회차</h2><span class="act" id="sc-run-badge"></span></div><div id="sc-run"></div></div>
        <div class="card"><div class="card-h"><h2>최근 7일 닫은 줄</h2><span class="desc">하루 목표 10줄</span></div><div class="sc-week" id="sc-week"></div></div>
      </div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>등록 준비</h2><span class="act" id="sc-ap"></span></div><ul class="list" id="sc-ready"></ul></div>
        <div class="card"><div class="card-h"><h2>외부 대기</h2><span class="desc">답·조건을 기다리는 줄</span></div><ul class="list" id="sc-wait"></ul></div>
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

  function render(d) {
    const c = d.counts, ap = d.approval || {}, run = d.run || {};
    const pct = Math.round(d.closed / Math.max(1, d.total) * 100);
    $('sc-title').textContent = run.running ? '⑨ 소싱 회차 진행 중' : `장부 ${d.total}줄 중 ${d.closed}줄 닫음 · ${pct}%`;
    $('sc-lead').textContent = `오늘 ${d.today.n}줄 처리 · 열린 줄 ${d.open}(원가 근거 없음 ${d.nocost}) · 등록 준비 ${d.ready.length}줄` +
      (ap.status === 'pending' ? ' — 사장님 승인 기다림' : ap.status === 'approved' ? ' — 승인됨, 다음 회차가 등록' : '');
    const st = $('sc-stats'); st.innerHTML = '';
    st.append(stat('오늘 처리', `${d.today.n}`, Object.entries(d.today.by).map(([k, v]) => `${k} ${v}`).join(' · ') || `목표 ${d.today.target}줄`, d.today.n ? 'run' : ''),
      stat('등록', `${c['등록'] || 0}`, '플랫폼에 올라간 줄', ''), stat('등록 준비', `${d.ready.length}`, ap.status === 'pending' ? '승인 대기' : ap.status === 'approved' ? '승인됨' : '', d.ready.length ? 'warn' : ''),
      stat('남은 후보', `${d.open}`, `정밀확인 ${c['정밀확인'] || 0}`, ''), stat('외부 대기', `${c['외부대기'] || 0}`, '답 기다림', c['외부대기'] ? 'warn' : ''),
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
    rb.append(E('span', 'badge ' + (run.running ? 'run' : 'k-idle'), run.running ? '진행 중' : '쉬는 중'));
    const rr = $('sc-run'); rr.innerHTML = '';
    if (run.running) rr.append(E('div', null, `${hm(run.started)} 시작`));
    if (run.last) rr.append(E('div', 'muted small', `마지막 회차 ${hm(run.last.at)} ${run.last.verb}${run.last.rc && run.last.rc !== '0' ? ' (rc ' + run.last.rc + ')' : ''}`));
    else if (!run.running) rr.append(E('div', 'muted small', '아직 회차 없음'));
    if (run.next) rr.append(E('div', 'muted small', `다음 회차 ${hm(run.next)}`));
    if (run.steps && run.steps.length) { const s = E('div', 'sc-steps'); for (const x of run.steps) s.append(E('div', null, window.noEmoji ? window.noEmoji(x) : x)); rr.append(s); }
    const wk = $('sc-week'); wk.innerHTML = ''; const mx = Math.max(10, ...d.week.map((w) => w.n));
    for (const w of d.week) { const col = E('div'); col.title = `${w.day} ${w.n}줄`; const b = E('b'); b.style.height = `${w.n / mx * 100}%`; col.append(E('span', null, String(w.n)), b, E('span', null, w.day.slice(5).replace('-', '/'))); wk.append(col); }
    const ap_ = $('sc-ap'); ap_.innerHTML = '';
    if (ap.status && ap.status !== 'none') ap_.append(E('span', 'badge ' + (ap.status === 'pending' ? 'warn' : ap.status === 'approved' ? 'ok' : 'bad'), { pending: '승인 대기', approved: '승인됨', rejected: '거절됨' }[ap.status] || ap.status));
    const ur = $('sc-ready'); ur.innerHTML = '';
    if (!d.ready.length) empty(ur, '없음');
    for (const r of d.ready) ur.append(li(`${r.title} · ${r.qty}개`, `계획가 ${Object.entries(r.plan || {}).map(([k, v]) => `${k === 'naver' ? '네이버' : '쿠팡'} ${won(v)}`).join(' · ')} · 원가 ${won(r.cost)} · 이익 ${won(r.profit)}`, r.lead_id, ''));
    const uw = $('sc-wait'); uw.innerHTML = '';
    if (!d.waiting.length) empty(uw, '없음');
    for (const r of d.waiting) uw.append(li(`${r.title} · ${r.qty}개`, r.waiting || r.reason || '', `${hm(r.updated).slice(0, 5)}부터`, 'warn'));
    const uf = $('sc-feed'); uf.innerHTML = '';
    if (!d.recent.length) empty(uf, '없음');
    for (const h of d.recent) {
      const l = E('li'); const b = E('div', 'b');
      const top = E('div'); top.append(E('span', 'badge ' + (ST[h.state] || [, ''])[1], h.state), document.createTextNode(` ${h.title || h.lead_id}${h.qty ? ' · ' + h.qty + '개' : ''}`));
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
