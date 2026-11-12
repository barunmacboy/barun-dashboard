// 상품 발굴 화면 — 소싱 장부 진행을 실시간으로(2026-10-21 사장님: "소싱 작업 현황도 실시간으로 현황판과 디스코드에서 볼 수 있게").
// 읽기: GET /api/sourcing (dashboard/sourcing.py, 읽기 전용) — 탭이 보일 때 15초마다 다시 읽음. 줄 상태 바꾸기는 주문 장부 화면(소싱 장부 표)에서.
// 자리: index.html에 미리 있는 #p-sourcing을 채운다(보임·숨김은 'barun:page' 이벤트).
// 2026-11-12 리뉴얼: 화면 안 바로 가기, 긴 목록은 8줄 + 더 보기, 덜 급한 칸은 접어 둠, 서버 글의 파일 경로·영어 오류는 쉬운 말로(원문은 마우스를 올리면).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const won = (v) => v == null || v === '' ? '—' : Math.round(+v).toLocaleString('ko-KR') + '원';
  const hm = (iso) => !iso ? '' : String(iso).slice(5, 16).replace('T', ' ').replace('-', '/');
  const noE = (t) => (window.noEmoji ? window.noEmoji(t) : String(t ?? ''));
  // 장부 글 → 화면 글: 컴퓨터 파일 경로는 '파일', 쿠팡이 영어로 보낸 오류는 한국어로(원문은 title로)
  const plain = (t) => (window.plainText ? window.plainText(t) : noE(t));   // 화면 글 정리는 index.html plainText 한 곳
  // 상태 → 색(역할로): 등록=좋음, 외부대기=주의, 정밀확인=진행, 탈락=닫힘(회색), 후보=아직
  const ST = { 후보: ['var(--axis)', ''], 정밀확인: ['var(--st-run)', 'run'], 등록: ['var(--st-good)', 'ok'], 끝: ['var(--green-ink)', 'ok'],
    탈락: ['var(--muted)', ''], 외부대기: ['var(--st-warn)', 'warn'] };
  const STL = { 정밀확인: '자세히 확인 중', 외부대기: '외부 대기' };          // 장부 상태 이름 → 화면 말(값은 그대로)
  const sl = (s) => STL[s] || s;
  // 외부대기가 기다리는 것(dashboard/sourcing.py _wait_kind) — 2026-10-25: 28줄을 모두 '답 기다림'으로 보이던 것
  const WAIT = { 외부: '외부 답 기다림', 사장님: '사장님 결정 기다림', 구매처: '구매처 없음' };
  const waits = (w) => Object.entries(w || {}).filter(([, n]) => n).map(([k, n]) => `${WAIT[k] || k} ${n}`).join(' · ');
  // 자동 발굴(2026-10-26) 찾는 곳 이름(pricing/sourcing_ledger.METHODS + 400행·사람) · 쇼핑몰
  const SRC = { 우리판매: '우리 판매', 경쟁점: '경쟁 판매점', 순위: '해외직구 순위', 문의: '고객 문의', '400행': '첫 조사 400개', 사람: '사람이 직접' };
  const PLN = { naver: '네이버', coupang: '쿠팡' };
  const num = (v) => v == null ? '—' : String(v);
  const SHOW = 8;                                       // 긴 목록은 처음 8줄만(화면이 2만 px까지 길어지던 것)
  const opened = {};                                     // 목록 → 다 보기
  let timer = 0, busy = false, loaded = false, last = null;

  function install() {
    const sec = $('p-sourcing'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      #p-sourcing .stat { cursor: default; }
      #p-sourcing .row { cursor: default; } #p-sourcing .row:hover { background: none; }
      @media (min-width: 900px) { #sc-stats, #sc-m-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
      @media (max-width: 480px) { #sc-stats > :last-child:nth-child(odd), #sc-m-stats > :last-child:nth-child(odd) { grid-column: 1 / -1; } }
      .sc-nav { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 16px; }
      .sc-nav button { all: unset; box-sizing: border-box; height: 32px; padding: 0 12px; border-radius: 999px; background: var(--fill); color: var(--ink2); font-size: 13px; font-weight: 600;
        cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; transition: background-color .18s var(--ease); }
      .sc-nav button:hover { background: var(--hover); } .sc-nav button:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
      .sc-nav .n { font-variant-numeric: tabular-nums; color: var(--muted); }
      .sc-bar { display: flex; height: 28px; border-radius: 8px; overflow: hidden; gap: 2px; background: var(--card); margin: 4px 0 8px; }
      .sc-bar > span { display: block; min-width: 4px; }
      .sc-leg { display: flex; flex-wrap: wrap; gap: 8px 16px; font-size: 13px; color: var(--sub); }
      .sc-leg i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
      .sc-week { display: flex; align-items: flex-end; gap: 8px; height: 80px; margin-top: 8px; }
      .sc-week > div { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 2px; height: 100%; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
      .sc-week b { display: block; width: 100%; max-width: 28px; background: var(--st-run); border-radius: 4px 4px 0 0; min-height: 2px; }
      .sc-feed li { padding: 12px 4px; display: flex; gap: 12px; align-items: flex-start; }
      .sc-feed .t { color: var(--muted); font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; min-width: 72px; padding-top: 2px; }
      .sc-feed .b { flex: 1; min-width: 0; } .sc-feed .m { color: var(--sub); font-size: 13px; margin-top: 2px; }
      .sc-steps { margin: 8px 0 0; padding: 12px; background: var(--fill2); border-radius: var(--r-sm); font-size: 13px; color: var(--sub); }
      .sc-steps div + div { margin-top: 4px; }
      .sc-run > div + div { margin-top: 4px; }
      .sc-sub { margin: 20px 0 8px; font-weight: 700; font-size: 14px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; }
      .sc-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      .sc-scroll.fade-r { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent); }
      .sc-tbl { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
      .sc-tbl.fit { width: auto; min-width: min(100%, 520px); }
      .sc-tbl th { text-align: left; color: var(--muted); font-weight: 600; font-size: 12px; padding: 8px 12px; border-top: 0; border-bottom: 1px solid var(--line); white-space: nowrap; }
      .sc-tbl td { padding: 8px 12px; border-top: 0; border-bottom: 1px solid var(--line); white-space: nowrap; vertical-align: top; }
      .sc-tbl th:first-child, .sc-tbl td:first-child { padding-left: 0; }
      .sc-tbl .n { text-align: right; } .sc-tbl td.t { white-space: normal; min-width: 160px; max-width: 360px; width: 100%; }
      .sc-tbl a { color: inherit; text-decoration: underline; text-decoration-color: var(--axis); text-underline-offset: 2px; }
      .sc-tbl .pid { color: var(--muted); font-size: 12px; margin-left: 4px; }
      .sc-share { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 4px 12px; align-items: center; font-size: 13px; margin: 8px 0; }
      .sc-share .bar { height: 10px; border-radius: 5px; background: var(--fill2); overflow: hidden; }
      .sc-share .bar b { display: block; height: 100%; background: var(--st-run); border-radius: 5px; }
      .sc-share .m { grid-column: 2; color: var(--muted); font-size: 12px; }
      @media (max-width: 560px) { .sc-share { grid-template-columns: minmax(0, 1fr) 42%; } .sc-share .m { grid-column: 1 / -1; } }   /* 휴대폰: 설명이 좁은 오른쪽 칸에서 여러 줄로 깨지던 것 */
      .sc-li .row-body { gap: 2px; } .sc-li .row-title { font-size: 14px; }
      .sc-li .muted { font-size: 12.5px; overflow-wrap: anywhere; }
      .sc-li .id { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
      .sc-more { margin-top: 8px; }
      /* 접는 카드 — 머리글이 곧 접기 단추 */
      .sc-fold > summary { display: flex; align-items: center; gap: 4px 8px; flex-wrap: wrap; color: var(--ink); font-size: inherit; padding: 0; margin: 0; border-radius: 8px; }
      .sc-fold > summary::before { font-size: 20px; color: var(--muted); width: 12px; }
      .sc-fold > summary h2 { font-size: 16.5px; font-weight: 700; letter-spacing: -.02em; margin: 0; }
      .sc-fold > summary .desc { flex-basis: 100%; color: var(--muted); font-size: 13px; padding-left: 20px; }
      .sc-fold[open] > summary { margin-bottom: 12px; }
      .sc-in { margin-top: 8px; } .sc-in > summary { font-weight: 600; color: var(--sub); }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero" id="sc-top"><h2 id="sc-title">불러오는 중…</h2><p class="lead" id="sc-lead"></p><div class="stats" id="sc-stats"></div>
        <nav class="sc-nav" id="sc-nav" aria-label="이 화면 안 바로 가기">
          <button type="button" data-go="sc-m">자동 발굴</button><button type="button" data-go="sc-progress">장부 진행</button>
          <button type="button" data-go="sc-ready-card">등록 준비 <span class="n" id="sc-n-ready"></span></button><button type="button" data-go="sc-wait-card">외부 대기 <span class="n" id="sc-n-wait"></span></button>
          <button type="button" data-go="sc-feed-card">최근 바뀐 줄</button><button type="button" data-go="sc-next-card">다음 차례</button><button type="button" data-go="sc-gap-card">원가 빈 등록상품 <span class="n" id="sc-n-gap"></span></button>
        </nav></div>
      <div class="card" id="sc-m" hidden><div class="card-h"><h2>자동 발굴</h2><span class="desc" id="sc-m-desc">찾기 → 거르기 → 올리기 → 판매 확인</span></div>
        <div class="stats" id="sc-m-stats"></div>
        <div class="sc-sub">찾는 곳별 흐름</div><div class="sc-scroll"><table class="sc-tbl fit" id="sc-m-funnel"></table></div>
        <div class="sc-sub">찾는 곳 점수 <span class="muted small" id="sc-m-wdesc"></span></div><div id="sc-m-score"></div>
        <details class="sc-in"><summary id="sc-m-psum">올린 상품 성과</summary><p class="muted small" id="sc-m-pdesc" style="margin:8px 0 0"></p><div class="sc-scroll"><table class="sc-tbl" id="sc-m-perf"></table></div></details></div>
      <div class="card" id="sc-progress"><div class="card-h"><h2 id="sc-bar-title">장부 진행</h2><span class="desc" id="sc-bar-desc">끝·탈락·외부대기를 닫힌 줄로 봐요</span></div>
        <div class="sc-bar" id="sc-bar" role="img"></div><div class="sc-leg" id="sc-leg"></div></div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>⑨ 소싱 회차</h2><span class="act" id="sc-run-badge"></span></div><div class="sc-run" id="sc-run"></div></div>
        <div class="card"><div class="card-h"><h2>최근 7일 새로 닫은 줄</h2><span class="desc">상태가 닫힘으로 바뀐 줄 · 하루 목표 10줄</span></div><div class="sc-week" id="sc-week"></div></div>
      </div>
      <div class="grid2">
        <div class="card" id="sc-ready-card"><div class="card-h"><h2>등록 준비</h2><span class="act" id="sc-ap"></span><span class="desc">이익은 시장가로 팔 때 기준이에요</span></div><ul class="list sc-li" id="sc-ready"></ul></div>
        <div class="card" id="sc-wait-card"><div class="card-h"><h2>외부 대기</h2><span class="desc" id="sc-wait-desc">답·결정·조건을 기다리는 줄</span></div><ul class="list sc-li" id="sc-wait"></ul></div>
      </div>
      <details class="card sc-fold" id="sc-feed-card"><summary><h2>최근 바뀐 줄</h2><span class="desc">상태는 주문 장부의 소싱 장부 표에서 고쳐요</span></summary><ul class="list sc-feed" id="sc-feed"></ul></details>
      <details class="card sc-fold" id="sc-next-card"><summary><h2>다음 차례 10줄</h2><span class="desc">다음 회차가 먼저 볼 줄</span></summary><ul class="list sc-li" id="sc-next"></ul></details>
      <details class="card sc-fold" id="sc-gap-card"><summary><h2>원가 빈 등록상품</h2><span class="desc" id="sc-gap-at">팔린 순 · 원가는 #할-일 카드에 답글로 알려 주세요</span></summary><ul class="list sc-li" id="sc-gap"></ul></details>`;
    // 바로 가기 — 접힌 칸이면 펼치고 그 칸으로
    sec.addEventListener('click', (e) => {
      const b = e.target && e.target.closest ? e.target.closest('[data-go]') : null; if (!b) return;
      const t = $(b.dataset.go); if (!t || t.hidden) return;
      if (t.tagName === 'DETAILS') t.open = true;
      t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // 보임·숨김은 index.html이 'barun:page'로 알려 줌(2026-10-22 리뉴얼 — 탭 덧붙이기·showTab 덮어쓰기 없앰)
    document.addEventListener('barun:page', (e) => { if (e.detail === 'sourcing') { load(); start(); } else stop(); });
    if (!sec.hidden) { load(); start(); }
    return true;
  }

  const start = () => { stop(); timer = setInterval(() => { if (!document.hidden && !$('p-sourcing').hidden) load(); }, 15000); };
  const stop = () => { if (timer) clearInterval(timer); timer = 0; };

  function li(title, sub, badge, cls, raw) {
    const l = E('li'); const r = E('div', 'row');
    const b = E('div', 'row-body'); b.append(E('span', 'row-title', title)); if (sub) b.append(E('span', 'muted', sub));
    if (raw && raw !== sub) l.title = `원문: ${raw}`;
    r.append(b); if (badge) r.append(E('span', 'badge ' + (cls || ''), badge)); l.append(r); return l;
  }
  const empty = (ul, t) => { ul.innerHTML = ''; ul.append(E('li', 'empty', t)); };
  // 긴 목록: 처음 SHOW줄 + '더 보기'(다시 누르면 접기)
  function fill(ul, key, items, make) {
    const all = opened[key], list = all ? items : items.slice(0, SHOW);
    for (const x of list) ul.append(make(x));
    if (items.length > SHOW) {
      const l = E('li'); const b = E('button', 'btn ghost sm sc-more', all ? '접기' : `${items.length - SHOW}줄 더 보기`); b.type = 'button';
      b.onclick = () => { opened[key] = !all; if (last) render(last); }; l.append(b); ul.append(l);
    }
  }
  const stat = (k, v, d, cls) => { const s = E('div', 'stat ' + (cls || '')); s.append(E('div', 'k', k), E('div', 'v', v), E('div', 'd', d || '')); s.title = d || ''; return s; };

  // 표 한 줄 — vals: 글자 또는 요소, nums: 오른쪽 맞춤할 칸 번호
  function trow(tag, vals, nums = []) {
    const tr = E('tr');
    vals.forEach((v, i) => { const c = E(tag, nums.includes(i) ? 'n' : null); if (v instanceof Object && v.append) c.append(v); else c.textContent = v == null ? '' : String(v); tr.append(c); });
    return tr;
  }
  const ext = (t, url) => { if (!/^https?:\/\//i.test(url || '')) return E('span', null, t); /* 2026-11-06: 긁어 온 후보 주소는 http(s)만 링크로 */ const a = E('a', null, t); a.href = url; a.target = '_blank'; a.rel = 'noopener'; return a; };

  // 자동 발굴(2026-10-26 사장님 "소싱 작업의 대 혁신") — pricing/performance.summary: 깔때기 · 오늘 자동 등록 몫 · 출처 점수 · 올린 상품 성과
  function machine(m) {
    const box = $('sc-m'); if (!box) return;
    box.hidden = !m;
    if (!m) return;
    if (m.error) { $('sc-m-desc').textContent = '자동 발굴 자료를 읽지 못했어요 · ' + m.error; return; }
    const a = m.auto || {}, cf = m.conf || {}, W = cf.watch || 14, S = cf.stop || 30, WIN = cf.window || 30;
    const stale = m.stale || [], watch = m.watch || [];
    $('sc-m-desc').textContent = '찾기 → 거르기 → 올리기 → 판매 확인';
    const st = $('sc-m-stats'); st.innerHTML = '';
    st.append(stat('오늘 자동 등록', `${a.today || 0}/${a.max || 0}`, a.on ? '조건을 통과한 줄은 바로 올려요' : '자동 등록 꺼짐', a.today ? 'ok' : ''),
      stat('오늘 새로 찾음', `${m.found_today || 0}`, '네 곳에서 찾은 후보', ''),
      stat('올린 상품', `${m.total || 0}`, `팔린 것 ${m.sold || 0} · 주문 ${m.orders || 0}건`, m.sold ? 'ok' : ''),
      stat(`${W}일째 주문 0`, `${watch.length}`, watch.length ? '지켜보는 중' : '지켜볼 상품 없음', watch.length ? 'warn' : ''),
      stat(`${S}일 동안 안 팔림`, `${stale.length}`, stale.length ? '#할-일에 정리 제안' : '정리할 상품 없음', stale.length ? 'warn' : ''));
    if (m.unlinked) st.append(stat('못 이음', `${m.unlinked}`, '판매 목록에서 못 찾음', 'bad'));
    // ① 찾는 곳별 흐름(첫 조사 400개·사람이 직접 올린 것도 같이)
    const fu = $('sc-m-funnel'); fu.innerHTML = '';
    fu.append(trow('th', ['찾는 곳', '찾음', '거르기 통과', '탈락', '올림', `${W}일 안에 팔림`], [1, 2, 3, 4, 5]));
    for (const f of m.funnel || []) fu.append(trow('td', [SRC[f.source] || f.source, num(f.found), num(f.passed), num(f.dropped), num(f.registered), num(f.sold14)], [1, 2, 3, 4, 5]));
    // ④ 찾는 곳 점수 — 하루 찾을 몫(weights, 없으면 설정값)
    const sc = $('sc-m-score'); sc.innerHTML = '';
    $('sc-m-wdesc').textContent = m.weights ? '· 하루 찾을 몫을 이 비율로 나눠요' : '· 아직 자료가 적어 하루 몫은 기본값대로 나눠요(올린 줄 3개 미만)';
    for (const s of m.scores || []) {
      const share = s.method ? (s.share != null ? s.share : s.quota) : null;
      const row = E('div', 'sc-share'), bar = E('div', 'bar'), b = E('b');
      b.style.width = share != null ? `${Math.round(share * 100)}%` : '0%'; bar.append(b);
      const desc = [s.method ? `하루 몫 ${Math.round((share || 0) * 100)}%${s.share != null && s.enough ? '' : ' · 기본값'}` : '하루 몫 없음',
        `올림 ${s.n}줄 · ${WIN}일 주문 ${s.orders30}건`, s.rate != null ? `${WIN}일 환산 1줄당 ${s.rate}건` : ''].filter(Boolean).join(' · ');
      row.append(E('span', null, SRC[s.source] || s.source), bar, E('span', 'm', desc)); sc.append(row);
    }
    if (m.top) sc.append(E('p', 'muted small', `${WIN}일 판매 1위는 ${SRC[m.top.source] || m.top.source}예요. 환산은 올린 지 ${WIN}일이 안 된 줄을 지난 날수로 나눠 ${WIN}일로 맞춘 값이에요.`));
    // ③ 올린 상품 성과 — 새로 올린 순(길어서 접어 둠)
    const key = (r) => `${r.platform}:${r.lead_id}`;
    const ss = new Set(stale.map(key)), ws = new Set(watch.map(key));
    const rows = m.rows || [];
    $('sc-m-psum').textContent = `올린 상품 성과 ${rows.length + (m.more || 0)}개`;
    $('sc-m-pdesc').textContent = `새로 올린 순 · 취소·반품 뺌${m.more ? ` · 아래 말고 ${m.more}개 더` : ''}`;
    const pf = $('sc-m-perf'); pf.innerHTML = '';
    pf.append(trow('th', ['올린 날', '상품', '쇼핑몰', '찾은 곳', '자동', `${W}일`, `${WIN}일`, '상태'], [5, 6]));
    for (const r of rows) {
      const t = E('span'); t.append(ext(r.title, r.link || r.wing)); if (r.pid) t.append(E('span', 'pid', ` ${r.pid}`));
      const cls = !r.linked ? 'bad' : ss.has(key(r)) || ws.has(key(r)) ? 'warn' : r.selling ? 'ok' : 'run';
      const word = ss.has(key(r)) ? `${S}일 안 팔림` : ws.has(key(r)) ? `${W}일째 0` : r.status;
      const tr = trow('td', [hm(r.at).slice(0, 5), t, PLN[r.platform] || r.platform, SRC[r.source] || r.source, r.auto ? '자동' : '',
        r.days < W ? `${r.o14} · ${r.days}일째` : `${r.o14}`, `${r.o30}`, E('span', 'badge ' + cls, word)], [5, 6]);
      tr.children[1].className = 't';
      if (r.orders) tr.title = `주문 ${r.orders}건 · 매출 ${won(r.sales)}${r.canceled ? ` · 취소·반품 ${r.canceled}건 뺌` : ''}`;
      pf.append(tr);
    }
    if (!rows.length) { const tr = E('tr'), td = E('td', 'muted small', '아직 발굴로 올린 상품이 없어요.'); td.colSpan = 8; tr.append(td); pf.append(tr); }
  }
  window.barunSourcingMachine = machine;     // 시험(dashboard/tests/test_sourcing.py)이 브라우저 없이 부름

  function render(d) {
    last = d;
    try { machine(d.machine); } catch (e) { console.error('자동 발굴 칸', e); }    // 이 칸이 깨져도 아래 장부 화면은 그대로
    const c = d.counts, ap = d.approval || {}, run = d.run || {}, t = d.today || {}, act = run.activity || {}, reg = d.registered || {}, man = d.manual || {};
    const pct = Math.round(d.closed / Math.max(1, d.total) * 100), N = (v) => (+v || 0).toLocaleString('ko-KR');
    const title = $('sc-title'); title.textContent = '';
    if (run.running) title.textContent = '⑨ 소싱 회차가 돌고 있어요';
    else title.append(document.createTextNode(`장부 ${N(d.total)}줄 중 `), E('em', null, `${N(d.closed)}줄(${pct}%)`), document.createTextNode('을 닫았어요'));
    // 2026-10-25: '오늘 처리'가 재확인 메모만 남긴 줄까지 셌음 → 상태가 실제로 바뀐 줄과 재확인을 따로
    $('sc-lead').textContent = `오늘 상태 바뀐 줄 ${t.n}(재확인 ${t.recheck || 0}) · 남은 후보 ${d.open}(원가 근거 없음 ${d.nocost}) · 등록 준비 ${d.ready.length}줄` +
      (ap.status === 'pending' ? '. 사장님 승인을 기다려요.' : ap.status === 'approved' ? '. 승인됐고 다음 회차가 등록해요.' : '');
    $('sc-bar-title').textContent = `장부 ${N(d.total)}줄 상태`;
    $('sc-bar-desc').textContent = '끝·탈락·외부 대기를 닫힌 줄로 봐요' + (man.n ? ` · 장부 밖에서 직접 올린 ${man.n}줄은 빼고 셌어요` : '');
    const st = $('sc-stats'); st.innerHTML = '';
    st.append(stat('오늘 상태 바뀐 줄', `${t.n}`, [Object.entries(t.by || {}).map(([k, v]) => `${sl(k)} ${v}`).join(' · '), t.recheck ? `재확인 ${t.recheck}` : ''].filter(Boolean).join(' · ') || `목표 ${t.target}줄`, t.n ? 'run' : ''),
      stat('등록한 조사 줄', `${c['등록'] || 0}`, reg.products != null ? `같은 물건 묶으면 ${reg.products}개` : '', ''),
      stat('등록 준비', `${d.ready.length}`, ap.status === 'pending' ? '승인 대기' : ap.status === 'approved' ? '승인됨' : '승인 카드 없음', d.ready.length ? 'warn' : ''),
      stat('남은 후보', `${d.open}`, `자세히 확인 중 ${c['정밀확인'] || 0}`, ''), stat('외부 대기', `${c['외부대기'] || 0}`, waits(d.waits) || '답 기다림', c['외부대기'] ? 'warn' : ''),
      stat('탈락', `${c['탈락'] || 0}`, '이익·원가 기준 미달', ''));
    const gap = d.costgap;   // 2026-10-24 원가 원본(barun.db): 원가 빈 판매 상품 수(하루 1번)
    // 2026-11-06: 상품 대장 '원가 모름'(같은 물건 묶음 수)과 숫자가 달라 헷갈려서 — 이건 쿠팡·네이버 등록상품 수(같은 물건이 둘에 있으면 2)
    if (gap) st.append(stat('원가 빈 등록상품', `${gap.products}`, `쿠팡 ${gap.coupang} · 네이버 ${gap.naver} · 옵션 ${gap.options}`, gap.products ? 'warn' : ''));
    $('sc-n-ready').textContent = d.ready.length || ''; $('sc-n-wait').textContent = d.waiting.length || ''; $('sc-n-gap').textContent = gap && gap.products ? gap.products : '';
    const ug = $('sc-gap'); ug.innerHTML = '';
    if (!gap) empty(ug, '아직 세지 않았어요. 하루 한 번 새로 세어요.');
    else if (!gap.list.length) empty(ug, '원가가 빈 등록상품이 없어요.');
    else {
      $('sc-gap-at').textContent = `${hm(gap.at)} 기준 · 팔린 순 · 원가는 #할-일 카드에 답글로 알려 주세요`;
      fill(ug, 'gap', gap.list, (g) => li(g.name, `${g.platform === 'coupang' ? '쿠팡' : '네이버'} · 옵션 ${g.n}개${g.orders ? ' · 주문 ' + g.orders + '건' : ''}`, '', ''));
      if (gap.products > gap.list.length) ug.append(E('li', 'empty', `목록 밖에 ${gap.products - gap.list.length}개 더 있어요.`));
    }
    const bar = $('sc-bar'), leg = $('sc-leg'); bar.innerHTML = ''; leg.innerHTML = '';
    bar.setAttribute('aria-label', d.order.map((s) => `${sl(s)} ${c[s] || 0}`).join(', '));
    for (const s of d.order) {
      const n = c[s] || 0; if (!n) continue;
      const seg = E('span'); seg.style.flex = String(n); seg.style.background = (ST[s] || ['var(--muted)'])[0]; seg.title = `${sl(s)} ${n}줄`; bar.append(seg);
      const l = E('span'); const i = E('i'); i.style.background = (ST[s] || ['var(--muted)'])[0]; l.append(i, document.createTextNode(`${sl(s)} ${n}`)); leg.append(l);
    }
    const rb = $('sc-run-badge'); rb.innerHTML = '';
    rb.append(E('span', 'badge ' + (run.running || act.active ? 'run' : 'k-idle'), run.running ? '진행 중' : act.active ? '회차 밖 작업 중' : '쉬는 중'));
    const rr = $('sc-run'); rr.innerHTML = '';
    if (run.running) rr.append(E('div', null, `${hm(run.started)} 시작`));
    if (run.last) { const l = E('div', 'muted small', `마지막 회차 ${hm(run.last.at)} ${run.last.verb}${run.last.rc && run.last.rc !== '0' ? ' · 오류로 끝남' : ''}`); if (run.last.rc) l.title = `종료 코드 ${run.last.rc}`; rr.append(l); }
    else if (!run.running) rr.append(E('div', 'muted small', '아직 돈 회차가 없어요.'));
    if (run.next) rr.append(E('div', 'muted small', `다음 회차 ${hm(run.next)}`));
    // 2026-10-25: 작업판·Codex가 회차 밖에서 등록해도 '쉬는 중'만 보이던 것 → 장부·등록 기록의 마지막 시각을 같이
    if (act.ledger) rr.append(E('div', 'muted small', `장부 마지막 변경 ${hm(act.ledger.at)} · ${act.ledger.title || act.ledger.lead_id}`));
    if (act.reg) rr.append(E('div', 'muted small', `마지막 등록 기록 ${hm(act.reg.at)} · ${act.reg.platform === 'naver' ? '네이버' : act.reg.platform === 'coupang' ? '쿠팡' : act.reg.platform || ''} ${act.reg.action || ''}${act.reg.ok ? '' : ' · 실패'}`));
    if (run.steps && run.steps.length) { const s = E('div', 'sc-steps'); for (const x of run.steps) s.append(E('div', null, plain(x))); rr.append(s); }
    const wk = $('sc-week'); wk.innerHTML = ''; const mx = Math.max(10, ...d.week.map((w) => w.n));
    for (const w of d.week) { const col = E('div'); col.title = `${w.day} ${w.n}줄`; const b = E('b'); b.style.height = `${w.n / mx * 100}%`; col.append(E('span', null, String(w.n)), b, E('span', null, w.day.slice(5).replace('-', '/'))); wk.append(col); }
    const ap_ = $('sc-ap'); ap_.innerHTML = '';
    if (ap.status && ap.status !== 'none') ap_.append(E('span', 'badge ' + (ap.status === 'pending' ? 'warn' : ap.status === 'approved' ? 'ok' : 'bad'), { pending: '승인 대기', approved: '승인됨', rejected: '거절됨' }[ap.status] || ap.status));
    const ur = $('sc-ready'); ur.innerHTML = '';
    if (!d.ready.length) empty(ur, '등록을 준비하는 줄이 없어요.');
    // 이익 = 시장가로 팔 때(장부 profit) — 계획가로 판 이익이 아님(2026-11-12 점검: '계획가 224,730 · 원가 206,237 · 이익 204,676원'이 안 맞아 보이던 것)
    fill(ur, 'ready', d.ready, (r) => {
      const l = li(`${r.title} · ${r.qty}개`, `계획가 ${Object.entries(r.plan || {}).map(([k, v]) => `${k === 'naver' ? '네이버' : '쿠팡'} ${won(v)}`).join(' · ')} · 원가 ${won(r.cost)} · 시장가로 팔면 이익 ${won(r.profit)}`, '', '');
      l.firstChild.append(E('span', 'id', r.lead_id)); return l;
    });
    const uw = $('sc-wait'); uw.innerHTML = '';
    $('sc-wait-desc').textContent = waits(d.waits) || '답·결정·조건을 기다리는 줄';
    if (!d.waiting.length) empty(uw, '기다리는 줄이 없어요.');
    // 'n/n부터' = 외부대기로 들어온 날(이력) — 전엔 장부 동기화 시각이라 모두 오늘 날짜
    fill(uw, 'wait', d.waiting, (r) => { const raw = noE(r.waiting || r.reason || ''); return li(`${r.title} · ${r.qty}개`, `${WAIT[r.wait] ? WAIT[r.wait] + ' · ' : ''}${plain(raw)}`, `${hm(r.since || r.updated).slice(0, 5)}부터`, r.wait === '사장님' ? 'warn' : '', raw); });
    const uf = $('sc-feed'); uf.innerHTML = '';
    if (!d.recent.length) empty(uf, '아직 바뀐 줄이 없어요.');
    fill(uf, 'feed', d.recent, (h) => {
      const l = E('li'); const b = E('div', 'b');
      // 상태가 실제로 바뀐 이력만 그 상태 표시 — 재확인 메모('미등록'·'신규등록제외')가 '등록'으로 보이던 것(2026-10-25)
      const moved = h.changed !== false;
      const top = E('div'); top.append(E('span', 'badge ' + (moved ? (ST[h.state] || [, ''])[1] : ''), moved ? sl(h.state) : '재확인'),
        document.createTextNode(` ${h.title || h.lead_id}${h.qty ? ' · ' + h.qty + '개' : ''}${moved ? (h.prev ? ` · ${sl(h.prev)}에서` : '') : ` · 상태 그대로(${sl(h.state)})`}`));
      const m = E('div', 'm', plain(h.memo || '')); if (h.memo && plain(h.memo) !== noE(h.memo)) m.title = `원문: ${noE(h.memo)}`;
      b.append(top, m); l.append(E('span', 't', hm(h.at)), b); return l;
    });
    const un = $('sc-next'); un.innerHTML = '';
    if (!d.next.length) empty(un, '남은 열린 줄이 없어요.');
    for (const r of d.next) un.append(li(`${r.title} · ${r.qty}개`, (r.marks || []).join(' · ') || (r.profit != null ? `시장가로 팔면 이익 ${won(r.profit)}` : ''), sl(r.state), (ST[r.state] || [, ''])[1]));
    document.querySelectorAll('#p-sourcing .sc-scroll').forEach((x) => { x.classList.toggle('fade-r', x.scrollLeft + x.clientWidth < x.scrollWidth - 2); if (!x._f) { x._f = 1; x.addEventListener('scroll', () => x.classList.toggle('fade-r', x.scrollLeft + x.clientWidth < x.scrollWidth - 2), { passive: true }); } });
  }

  async function load() {
    if (busy) return; busy = true;
    // 2026-11-06: 503이면 '불러오는 중'에 멈춰 있던 것 → 실패를 보임(읽은 적 있으면 화면은 그대로, 원문은 마우스를 올리면)
    try {
      const r = await (window.barunFetch || fetch)('/api/sourcing');
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      render(await r.json()); loaded = true;
    } catch (e) {
      if (e.message === '로그인 필요') return;
      if (!loaded) $('sc-title').textContent = '상품 발굴 자료를 읽지 못했어요';
      const l = $('sc-lead'); l.textContent = '15초 뒤에 다시 읽어요.' + (loaded ? ' 아래는 마지막으로 읽은 내용이에요.' : ''); l.title = `원문: ${e.message}`;
    } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
