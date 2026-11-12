// 자동화율 화면 — 완전 자동화 목표(사람 손 2% 미만)까지 어디쯤인지: 큰 숫자 → 흐름 띠(단계별 수준) → 단계 자세히 → 추이 → 로드맵·다음 할 일 → 새로 찾은 여지
// (2026-10-22 사장님: "파이프라인을 작업 단위로 쪼개 자동화 단계와 전체 자동화율을 한눈에"). 읽기: GET /api/automation(autoimprove/pipeline.py).
// '자동 구매' 영역(구매처별 켜짐·멈춤·한도·최근 결제 — GET /api/autobuy, [멈춤]/[다시 켜기]만 쓰기)은 dashboard/autobuy.py.
// 원본은 config/pipeline.toml — 화면은 보여 주기만. 자리: index.html에 미리 있는 화면(#p-…)을 채운다(보임·숨김은 'barun:page' 이벤트).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  // 수준 → 색(순서 있는 척도, 글자로도 함께 표시 — 색만으로 구분하지 않음)
  const LV = [['사람', 'var(--st-crit)'], ['자료만', 'var(--st-serious)'], ['반자동', 'var(--st-warn)'], ['자동', 'var(--st-run)'], ['완전 자동', 'var(--st-good)']];
  const ST = { done: ['', 'ok', '끝남'], doing: ['', 'run', '진행 중'], todo: ['', '', '할 일'] };
  const noE = (t) => (window.noEmoji ? window.noEmoji(t) : String(t ?? ''));
  // 2026-11-12 리뉴얼: 화면 글에서 코드 위치·내부 작업 이름을 빼고, ' — ' 이음은 '·'로, 1분 넘는 초는 분으로(뜻은 그대로)
  const JOB = { 'auto-orders': '주문 자동화', 'auto-forward': '배대지 자동 신청', 'auto-mail': '메일 자동화', 'postgo-watch': '포스트고 감시', 'barun-tick': '매시간 점검' };
  // 화면 글 정리: 작업 이름만 여기서, 나머지(코드 위치·이음표·초→분)는 index.html plainText 한 곳(2026-11-12)
  const plain = (t) => { const s = noE(t).replace(/\b(?:auto-orders|auto-forward|auto-mail|postgo-watch|barun-tick)\b/g, (m) => JOB[m]);
    return window.plainText ? window.plainText(s, { strict: true }) : s; };
  // 새로 찾은 여지: 오류 원문(JSON·영어 오류)은 접고 한 줄로
  function idea(text) {
    const raw = noE(text);
    const cnt = (raw.match(/\((최근 7일[^()]*)\)\s*$/) || [])[1] || '';
    const body = cnt ? raw.slice(0, raw.lastIndexOf('(' + cnt)).trim() : raw;
    const cut = body.search(/\s+[—–]\s+(?=.*(?:[{]|Error|Exit code|\/Users\/|가장 많은 것:))/s);
    const msg = (s) => s.replace(/Bash 시도/g, '명령 시도').replace(/턴 (\d+) · \$([\d.]+) \(예산 \$([\d.]+)\)/, '한 회차 비용 $$$2(예산 $$$3) · 주고받기 $1번');
    if (cut < 0) return { line: plain(msg(body)) + (cnt ? ` · ${cnt}` : ''), raw: '' };
    return { line: plain(msg(body.slice(0, cut))) + (cnt ? ` · ${cnt}` : ''), raw };
  }
  window.barunAutomationIdea = idea; window.barunAutomationPlain = plain;   // 시험용
  const mark = (st) => { const e = E('span', 'au-mk ' + (st || 'todo')); if (st === 'done') e.innerHTML = window.ico ? window.ico('check') : ''; return e; };   // 끝·진행·할 일 표시를 그림으로
  let timer = 0, busy = false, data = null, pick = null;

  function install() {
    const sec = $('p-auto'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      #p-auto .stat { cursor: default; }
      @media (hover: hover) { #p-auto .stat:hover { transform: none; background: var(--fill2); box-shadow: inset 0 0 0 1px var(--line); } }
      @media (hover: hover) and (prefers-color-scheme: dark) { #p-auto .stat:hover { box-shadow: none; } }
      #au-stats { margin-top: 16px; }
      #au-stats .stat .d { white-space: normal; overflow: visible; }
      .au-meter { position: relative; height: 12px; border-radius: 6px; background: var(--fill); margin: 16px 0 8px; }
      .au-meter > b { display: block; height: 100%; border-radius: 6px; background: var(--st-run); transition: width .4s var(--ease, ease); }
      .au-meter > i { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--ink); border-radius: 1px; }
      .au-meter-l { position: relative; height: 18px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
      .au-meter-l span { position: absolute; top: 0; white-space: nowrap; }
      .au-flow-wrap { position: relative; }
      .au-flow { display: flex; gap: 8px; overflow-x: auto; padding: 4px 2px 12px; scroll-snap-type: x proximity; }
      .au-flow-wrap.more-r::after { content: ""; position: absolute; top: 0; right: 0; bottom: 12px; width: 40px; pointer-events: none;
        background: linear-gradient(to right, transparent, var(--card)); }
      .au-hint { font-size: 12px; color: var(--muted); text-align: right; margin: 0 0 4px; }
      .au-step { flex: 0 0 120px; width: 120px; min-height: 112px; align-self: stretch; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--card);
        padding: 8px 12px 12px; text-align: left; cursor: pointer; scroll-snap-align: start; position: relative; font: inherit; color: inherit;
        display: grid; grid-template-rows: auto 36px auto 1fr; align-content: start; overflow: hidden; }
      .au-step:hover { background: var(--hover); } .au-step:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
      .au-step[aria-pressed="true"] { border-color: var(--blue); box-shadow: 0 0 0 1px var(--blue) inset; }
      .au-step .n { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
      .au-step .nm { font-size: 13px; font-weight: 600; line-height: 18px; margin: 0; word-break: keep-all; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .au-step .lv { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--sub); white-space: nowrap; }
      .au-step .lv i, .au-leg i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex: none; }
      .au-step .pc { align-self: end; font-size: 16.5px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .au-step .pc.none { font-size: 13px; font-weight: 600; color: var(--muted); }
      .au-step .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; }
      .au-leg { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 12.5px; color: var(--sub); margin-bottom: 8px; }
      .au-leg span { display: inline-flex; align-items: center; gap: 6px; }
      .au-detail { margin-top: 8px; padding: 16px; background: var(--fill2); border-radius: var(--r-sm); }
      .au-detail .au-dh { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
      .au-detail .au-dh strong { font-size: 15px; }
      .au-detail dl { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 8px 12px; margin: 12px 0 0; font-size: 14px; }
      .au-detail dt { color: var(--muted); } .au-detail dd { margin: 0; color: var(--ink2); overflow-wrap: anywhere; }
      @media (max-width: 560px) { .au-detail dl { grid-template-columns: minmax(0, 1fr); gap: 2px; } .au-detail dd { margin-bottom: 8px; } }
      .au-list { list-style: none; margin: 0; padding: 0; }
      .au-li { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); min-width: 0; }
      .au-list > .au-li:first-child { border-top: 0; padding-top: 4px; }
      .au-li .au-b { flex: 1; min-width: 0; display: grid; gap: 2px; }
      .au-li .au-t { font-size: 14px; color: var(--ink); overflow-wrap: anywhere; }
      .au-li .au-s { font-size: 12.5px; color: var(--muted); }
      .au-li .badge { flex: none; margin-top: 1px; }
      .au-li details { margin-top: 2px; } .au-li pre { max-height: 200px; }
      .au-trend { position: relative; height: 140px; display: flex; gap: 4px; margin-top: 8px; }
      .au-trend .col { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; height: 100%; }
      .au-trend .stk { flex: 1; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
      .au-trend .vl, .au-trend .dy { font-size: 12px; line-height: 16px; height: 16px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .au-trend b { display: block; width: 100%; max-width: 24px; background: var(--st-run); border-radius: 4px 4px 0 0; min-height: 2px; }
      .au-trend .goal { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--sub); pointer-events: none; }
      .au-trend .goal span { position: absolute; right: 0; bottom: 2px; font-size: 12px; line-height: 16px; color: var(--sub); background: var(--card); padding: 0 4px; border-radius: 4px; }
      .au-phases { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; align-items: start; }
      .au-ph { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 12px; background: var(--card); min-width: 0; }
      .au-ph.now { border-color: var(--blue); background: var(--blue-bg); }
      .au-ph h3 { font-size: 14px; margin: 0 0 2px; } .au-ph .w { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
      .au-ph .g { font-size: 12.5px; color: var(--sub); margin: 8px 0; line-height: 1.45; }
      .au-ph .p { height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden; } .au-ph .p b { display: block; height: 100%; background: var(--st-good); }
      .au-ph ul { list-style: none; padding: 0; margin: 8px 0 0; font-size: 12.5px; } .au-ph li { padding: 4px 0; color: var(--sub); overflow-wrap: anywhere; }
      .au-ph li.done { color: var(--muted); }
      .au-ph details { margin-top: 4px; } .au-ph details > summary { font-size: 12.5px; }
      .au-mk { display: inline-flex; width: 12px; height: 12px; margin-right: 6px; vertical-align: -1px; align-items: center; justify-content: center; }
      .au-mk.todo { border: 1.5px solid var(--muted); border-radius: 50%; width: 10px; height: 10px; } .au-mk.doing { background: var(--st-run); border-radius: 50%; width: 10px; height: 10px; }
      .au-mk.done { color: var(--st-good); }
      #ab-lead { margin: 0; font-size: 14.5px; color: var(--sub); }
      #ab-note { margin: 4px 0 0; font-size: 13px; color: var(--muted); }
      .ab-shops { column-width: 320px; column-gap: 12px; margin-top: 16px; }   /* 높이가 다른 카드를 빈칸 없이 위에서부터 쌓음 */
      .ab-shop { break-inside: avoid; margin: 0 0 12px; border: 1px solid var(--line); border-radius: var(--r-sm); padding: 12px 16px 16px; background: var(--card); min-width: 0; }
      .ab-shop.off { background: var(--fill2); }
      .ab-shop h3 { font-size: 15px; margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 34px; }
      .ab-shop h3 .btn { margin-left: auto; }
      .ab-gauge { font-size: 12.5px; color: var(--sub); margin: 8px 0 4px; display: flex; justify-content: space-between; gap: 8px; font-variant-numeric: tabular-nums; }
      .ab-shop .p { height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden; } .ab-shop .p b { display: block; height: 100%; background: var(--st-run); }
      .ab-shop ul { list-style: none; padding: 0; margin: 8px 0 0; font-size: 13px; } .ab-shop li { padding: 8px 0; color: var(--sub); border-top: 1px solid var(--line); overflow-wrap: anywhere; }
      .ab-shop li:first-child { border-top: 0; } .ab-shop li .badge { margin-right: 6px; }
      .ab-shop li .num { font-variant-numeric: tabular-nums; color: var(--ink2); }
      .ab-shop li.ab-ph { font-weight: 600; color: var(--ink2); padding-top: 12px; }
      .ab-why { margin-top: 2px; font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
      .ab-shop .sub { font-size: 12.5px; color: var(--muted); margin-top: 8px; }
      #ab-other { margin-top: 8px; }
      @media (max-width: 900px) { .au-phases { grid-template-columns: minmax(0, 1fr); } }
      @media (max-width: 720px) { #au-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } #au-stats .stat:last-child:nth-child(odd) { grid-column: 1 / -1; } }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero"><h2 id="au-title">불러오는 중</h2><p class="lead" id="au-lead"></p>
        <div class="au-meter" id="au-meter" role="meter" aria-valuemin="0" aria-valuemax="100"><b></b><i></i></div>
        <div class="au-meter-l"><span style="left:0">0%</span><span id="au-goal-l"></span></div>
        <div class="stats" id="au-stats"></div></div>
      <div class="card" id="ab-card"><div class="card-h"><h2>자동 구매</h2><span class="desc" id="ab-d">구매처별 한도와 최근 결제예요. 멈춘 구매처는 결제하지 않아요.</span></div>
        <p id="ab-lead">불러오는 중…</p><p id="ab-note" hidden></p><div class="ab-shops" id="ab-shops"></div>
        <div class="sub muted small" id="ab-other"></div></div>
      <div class="card"><div class="card-h"><h2 id="au-flow-h">업무 흐름</h2><span class="desc">숫자는 최근 7일 동안 그 단계를 사람 손 없이 지난 비율이에요. 누르면 잰 방법이 보여요.</span></div>
        <div class="au-leg" id="au-leg"></div><p class="au-hint" id="au-hint" hidden>옆으로 밀면 단계가 더 있어요</p>
        <div class="au-flow-wrap" id="au-flow-wrap"><div class="au-flow" id="au-flow" role="group" aria-label="주문 흐름 단계"></div></div>
        <div class="au-detail" id="au-detail" aria-live="polite"></div></div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>이번 단계 할 일</h2><span class="desc" id="au-next-d"></span></div><ul class="au-list" id="au-next"></ul></div>
        <div class="card"><div class="card-h"><h2>최근 14일 추이</h2><span class="desc">사람 손 안 탄 비율 · 점선은 목표</span></div><div class="au-trend" id="au-trend" role="img"></div></div>
      </div>
      <div class="card"><div class="card-h"><h2>로드맵 5단계</h2><span class="desc">파란 칸이 지금 단계예요. 끝난 일은 접어 뒀어요.</span></div><div class="au-phases" id="au-phases"></div></div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>사람 카드가 나온 업무</h2><span class="desc">최근 7일 #할-일 카드</span></div><ul class="au-list" id="au-cards"></ul></div>
        <div class="card"><div class="card-h"><h2>더 자동화할 수 있는 곳</h2><span class="desc">회차 점검과 에이전트가 찾았어요</span></div><ul class="au-list" id="au-ideas"></ul></div>
      </div>`;
    const fw = $('au-flow');
    fw.addEventListener('scroll', () => edge(), { passive: true });
    window.addEventListener('resize', () => edge());
    document.addEventListener('barun:page', (e) => { if (e.detail === 'auto') { load(); start(); } else stop(); });
    if (!sec.hidden) { load(); start(); }
    return true;
  }
  // 흐름 띠가 넘치면 오른쪽 흐림 + 안내 한 줄
  function edge() {
    const f = $('au-flow'), w = $('au-flow-wrap'), hint = $('au-hint'); if (!f) return;
    const over = f.scrollWidth > f.clientWidth + 2;
    hint.hidden = !over; w.classList.toggle('more-r', over && f.scrollLeft + f.clientWidth < f.scrollWidth - 2);
  }

  const start = () => { stop(); timer = setInterval(() => { if (!document.hidden && !$('p-auto').hidden) load(); }, 60000); };
  const stop = () => { if (timer) clearInterval(timer); timer = 0; };
  const stat = (k, v, d, cls) => { const s = E('div', 'stat ' + (cls || '')); s.append(E('div', 'k', k), E('div', 'v', v), E('div', 'd', d || '')); return s; };
  const pctTxt = (p) => p == null ? '—' : `${p}%`;
  const empty = (ul, t) => { ul.innerHTML = ''; ul.append(E('li', 'au-li muted small', t)); };
  function li(title, sub, badge, cls, raw, st) {
    const l = E('li', 'au-li'); const b = E('div', 'au-b');
    const t = E('span', 'au-t'); if (st !== undefined) t.append(mark(st)); t.append(document.createTextNode(title)); b.append(t);
    if (sub) b.append(E('span', 'au-s', sub));
    if (raw) { const d = E('details'); d.append(E('summary', null, '원문'), E('pre', null, raw)); b.append(d); }
    l.append(b); if (badge) l.append(E('span', 'badge ' + (cls || ''), badge)); return l;
  }
  const ROLE = { orders: '주문·발송', mail: '메일·송장', pricing: '가격·위너', inquiry: '고객문의', close: '마감·분석', improve: '개선', infra: '인프라', sourcing: '소싱·원가' };

  function detail(s) {
    const d = $('au-detail'); d.innerHTML = '';
    const h = E('div', 'au-dh'); h.append(E('strong', null, `${s.n}. ${s.name}`), E('span', 'badge', `수준 ${s.level} · ${s.level_name}`));
    if (s.pct != null) h.append(E('span', 'badge ' + (s.pct >= 98 ? 'ok' : s.pct >= 50 ? 'run' : 'warn'), `7일 ${s.auto}/${s.orders}${s.unit || '건'} 자동`));
    else h.append(E('span', 'badge', '최근 7일 동안 이 일 없음'));
    const dl = E('dl');
    for (const [k, v] of [['지금 방식', s.how], ['잰 방법', s.measure || ''], ['막힌 이유', s.blocker || '없음'], ['다음 단계', s.next || '지금대로 유지']]) if (v) dl.append(E('dt', null, k), E('dd', null, plain(v)));
    d.append(h, dl);
    if (s.tasks && s.tasks.length) {
      const ul = E('ul', 'au-list'); ul.style.marginTop = '8px';
      for (const t of s.tasks) ul.append(li(plain(t.title), `로드맵 ${t.phase}단계`, ST[t.state || 'todo'][2], ST[t.state || 'todo'][1], '', t.state || 'todo'));
      d.append(ul);
    }
  }

  function render(d) {
    data = d;
    const p = d.pct ?? 0, goal = d.goal;
    const worst = d.stages.filter((s) => s.pct != null && s.orders && s.applies !== 'asks').sort((a, b) => a.pct - b.pct || b.orders - a.orders)[0];
    $('au-title').textContent = `사람 손 안 탄 주문이 ${pctTxt(d.pct)}예요`;
    $('au-lead').textContent = `목표는 ${goal}%예요. 최근 ${d.days}일 주문 ${d.orders}건 중 ${d.done - d.touched}건을 처음부터 끝까지 자동으로 처리했어요.` +
      (worst ? ` ${worst.name} 단계에서 가장 많이 막혀요(자동 ${worst.auto}/${worst.orders}${worst.unit || '건'}).` : '');
    const m = $('au-meter'); m.querySelector('b').style.width = `${Math.min(100, p)}%`; m.querySelector('i').style.left = `${goal}%`;
    m.setAttribute('aria-valuenow', String(p)); m.setAttribute('aria-label', `사람 손 안 탄 주문 ${p}%, 목표 ${goal}%`);
    const gl = $('au-goal-l'); gl.textContent = `목표 ${goal}%`; gl.style.left = `${goal}%`; gl.style.transform = goal > 85 ? 'translateX(-100%)' : 'translateX(-50%)';
    const st = $('au-stats'); st.innerHTML = '';
    const ph = d.phases.find((x) => x.n === d.now_phase) || {};
    // 숫자 색은 뜻이 있을 때만(주문 100건당 카드가 목표 2장을 넘으면 주황)
    st.append(stat(`최근 ${d.days}일 주문`, `${d.orders}`, Object.entries(d.mix).map(([k, v]) => `${k} ${v}`).join(' · ')),
      stat('사람 손 탄 주문', `${d.touched}`, d.pending ? `처리 방식 미정 ${d.pending}건 빼고` : '한 번이라도 사람이 처리'),
      stat('주문 100건당 사람 카드', d.cards_per_100 == null ? '—' : `${d.cards_per_100}장`, `7일 동안 ${d.human_cards}장`, d.cards_per_100 > 2 ? 'warn' : ''),
      stat('단계 평균 자동화 수준', `${d.level_avg}%`, '수준 0~4의 평균'),
      stat('로드맵', `${d.now_phase}단계`, `${ph.title || ''} · ${ph.done || 0}/${ph.total || 0}`));
    const leg = $('au-leg'); leg.innerHTML = '';
    LV.forEach(([nm, c], i) => { const s = E('span'); const dot = E('i'); dot.style.background = c; s.append(dot, document.createTextNode(`${i} ${nm}`)); leg.append(s); });
    $('au-flow-h').textContent = `업무 흐름 ${d.stages.length}단계`;
    const fl = $('au-flow'); fl.innerHTML = '';
    if (!pick || !d.stages.some((s) => s.id === pick)) pick = (worst || d.stages[0]).id;
    for (const s of d.stages) {
      const b = E('button', 'au-step'); b.type = 'button'; b.setAttribute('aria-pressed', String(s.id === pick));
      b.setAttribute('aria-label', `${s.n}단계 ${s.name}, 수준 ${s.level} ${s.level_name}, 자동 비율 ${s.pct == null ? '없음' : s.pct + '%'}`);
      const lv = E('span', 'lv'); const dot = E('i'); dot.style.background = LV[s.level][1]; lv.append(dot, document.createTextNode(s.level_name));
      const bar = E('span', 'bar'); bar.style.background = LV[s.level][1];
      b.append(E('div', 'n', `${s.n}`), E('div', 'nm', s.name), lv, E('div', 'pc' + (s.pct == null ? ' none' : ''), s.pct == null ? '이 일 없음' : `${s.pct}%`), bar);
      b.title = s.pct == null ? '최근 7일 동안 이 일이 없었어요' : `7일 ${s.orders}${s.unit || '건'} 중 자동 ${s.auto}${s.unit || '건'}${s.measure ? ` · ${plain(s.measure)}` : ''}`;
      b.onclick = () => { pick = s.id; fl.querySelectorAll('.au-step').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); detail(s); };
      fl.append(b);
    }
    requestAnimationFrame(edge);
    detail(d.stages.find((s) => s.id === pick));
    const un = $('au-next'); un.innerHTML = ''; $('au-next-d').textContent = `${d.now_phase}단계 · ${ph.title || ''}`;
    if (!d.next.length) empty(un, '이번 단계 할 일을 모두 끝냈어요.');
    for (const t of d.next) un.append(li(plain(t.title), t.stage_name, ST[t.state || 'todo'][2], ST[t.state || 'todo'][1], '', t.state || 'todo'));
    // 14일 추이: 막대 칸(100px) 안에 목표 점선 — 칸 밖으로 나가지 않게
    const tr = $('au-trend'); tr.innerHTML = '';
    const PLOT = 100, g = E('div', 'goal'); g.style.top = `${16 + PLOT * (1 - Math.min(100, goal) / 100)}px`; g.append(E('span', null, `목표 ${goal}%`)); tr.append(g);
    tr.setAttribute('aria-label', d.trend.map((t) => `${t.day.slice(5).replace('-', '/')} ${t.pct == null ? '주문 없음' : t.pct + '%'}`).join(', '));
    for (const t of d.trend) {
      const col = E('div', 'col'); col.title = `${t.day.slice(5).replace('-', '/')} 주문 ${t.n}건 · ${pctTxt(t.pct)}`;
      const stk = E('div', 'stk');
      const b = E('b'); b.style.height = `${Math.max(2, (t.pct || 0) / 100 * PLOT)}px`; if (t.pct == null) b.style.background = 'var(--axis)';
      stk.append(E('span', 'vl', t.pct == null ? '' : String(Math.round(t.pct))), b);
      col.append(stk, E('span', 'dy', String(+t.day.slice(8))));
      tr.append(col);
    }
    const ps = $('au-phases'); ps.innerHTML = '';
    for (const x of d.phases) {
      const c = E('div', 'au-ph' + (x.n === d.now_phase ? ' now' : ''));
      const pb = E('div', 'p'); const bb = E('b'); bb.style.width = `${x.total ? x.done / x.total * 100 : 0}%`; pb.append(bb);
      const left = x.tasks.filter((t) => t.state !== 'done'), fin = x.tasks.filter((t) => t.state === 'done');
      const ul = E('ul');
      for (const t of left) { const l = E('li'); l.append(mark(t.state), document.createTextNode(plain(t.title))); ul.append(l); }
      c.append(E('h3', null, `${x.n}. ${x.title}`), E('div', 'w', `${x.when} · ${x.done}/${x.total}`), E('div', 'g', plain(x.goal)), pb);
      if (left.length) c.append(ul);
      if (fin.length) {
        const dd = E('details'); dd.append(E('summary', null, `끝난 일 ${fin.length}개`));
        const fu = E('ul'); for (const t of fin) { const l = E('li', 'done'); l.append(mark('done'), document.createTextNode(plain(t.title))); fu.append(l); }
        dd.append(fu); c.append(dd);
      }
      ps.append(c);
    }
    const uc = $('au-cards'); uc.innerHTML = '';
    const cr = Object.entries(d.cards_by_role).sort((a, b) => b[1] - a[1]);
    if (!cr.length) empty(uc, '최근 7일 동안 사람에게 넘긴 카드가 없어요.');
    for (const [r, n] of cr) uc.append(li(ROLE[r] || r || '기타', '', `${n}장`, n >= 10 ? 'warn' : ''));
    const ui = $('au-ideas'); ui.innerHTML = '';
    if (!d.ideas.length) empty(ui, '새로 찾은 곳이 없어요. 회차 점검이 찾으면 여기에 보여요.');
    const sn = Object.fromEntries(d.stages.map((s) => [s.id, s.name]));
    for (const i of d.ideas.slice(0, 12)) {
      const x = idea(i.text);
      ui.append(li(x.line, [(i.at || '').slice(5, 16).replace('T', ' ').replace('-', '/'), i.by || ''].filter(Boolean).join(' · '), sn[i.stage] || '공통', '', x.raw));
    }
  }

  // 자동 구매 — GET /api/autobuy(dashboard/autobuy.py), 멈춤·다시 켜기 POST /api/action {action:'autobuy_pause'|'autobuy_resume', key:구매처}
  const won = (n) => n == null ? '—' : `${Math.round(n).toLocaleString('ko-KR')}원`;
  const PST = { paid: ['결제됨', 'ok'], ready: ['결제 중', 'run'], blocked: ['막힘', 'warn'], failed: ['실패', 'bad'] };
  const hmS = (s) => (s || '').slice(5, 16).replace('T', ' ').replace('-', '/');
  // 구매처 이름: 도메인·영어 이름 → 사장님이 부르는 이름(모르면 그대로)
  const shopName = (v) => { const s = String(v || ''); const ko = window.koLabel || ((x) => x); const a = ko(s); if (a !== s) return a; const slug = s.split('.')[0]; const b = ko(slug); return b !== slug ? b : s; };
  // 막힌 이유 계산식: 빼기는 '−' 하나로, 손해는 '손해 −7,542원(정산 … − 결제 … − 운임 …)'
  const whyTxt = (w) => noE(w).split(' · ').map((part) => {
    const m = part.match(/^손해\s*[—–-]\s*정산 ([\d,]+) [−-] 결제 ([\d,]+) [−-] 운임 ([\d,]+) = -?([\d,]+)원$/);
    if (m) return `손해 −${m[4]}원(정산 ${m[1]} − 결제 ${m[2]} − 운임 ${m[3]})`;
    return part.replace(/\s+[—–]\s+/g, ': ').replace(/ - /g, ' − ').replace(/(^|[\s=(])-(\d)/g, '$1−$2');
  }).join(' · ');
  async function pauseBtn(shop, name, pause, btn) {
    if (!confirm(pause ? `${name} 자동 구매를 멈출까요? 다시 켤 때까지 결제하지 않아요.` : `${name} 자동 구매를 다시 켤까요?`)) return;
    btn.disabled = true;
    try {
      const r = await (window.barunFetch || fetch)('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: pause ? 'autobuy_pause' : 'autobuy_resume', key: shop }) });
      // 2026-11-06: 응답이 JSON이 아니면 'Unexpected token'만 떠서 멈췄는지 알 수 없었음 → 다시 읽은 상태로 확인하라고
      const j = await r.json().catch(() => ({ ok: false, msg: `응답을 읽지 못했어요(${r.status}). 아래 켜짐·멈춤 표시로 확인해 주세요.` }));
      if (window.toast) window.toast((j.ok ? '' : '실패: ') + (j.msg || (j.ok ? (pause ? '멈췄어요' : '다시 켰어요') : '서버가 이유를 주지 않았어요'))); loadBuy();
    } catch (e) { if (window.toast) window.toast('실패: ' + e.message); } finally { btn.disabled = false; }
  }
  function planLine(x) {
    return `${noE(x.product || '')}${x.option ? ' ' + noE(x.option) : ''} ${x.qty || ''}개` + (x.max_krw ? ` · 최대 ${won(x.max_krw)}` : x.unit_krw ? ` · 개당 ${won(x.unit_krw)}` : '');
  }
  function renderBuy(d) {
    const L = d.limits || {};
    const off = d.shops.filter((s) => s.paused).length, bad = d.shops.reduce((a, s) => a + (s.bad || 0), 0);
    const wait = d.plan.length;
    $('ab-lead').textContent = `오늘 ${won(d.today_krw)} 결제 · 하루 한도 ${won(L.day)} · 건당 한도 ${won(L.order)}` +
      ` · 멈춘 구매처 ${off}곳 · 최근 막힘·실패 ${bad}건` + (wait ? ` · 승인 기다리는 재고 구매 ${wait}건` : '');
    const note = $('ab-note'), unconf = d.shops.filter((s) => !s.confirmed).length;
    note.hidden = !unconf; note.textContent = unconf ? '첫 자동 결제는 사장님이 [결제] 버튼으로 한 번 확인한 뒤에 해요. 아직 확인 전인 곳은 꼬리표로 표시했어요.' : '';
    const box = $('ab-shops'); box.innerHTML = '';
    for (const s of d.shops) {
      const name = shopName(s.shop);
      const c = E('div', 'ab-shop' + (s.paused ? ' off' : ''));
      const h = E('h3', null, name); if (name !== s.shop) h.title = s.shop;
      h.append(E('span', 'badge ' + (s.paused ? 'warn' : 'ok'), s.paused ? '멈춤' : '켜짐'));
      if (!s.confirmed) h.append(E('span', 'badge', '첫 결제 확인 전'));
      // 2026-11-06: 초록 '켜짐' 옆 빨간 '멈춤' 버튼이 '켜졌는데 멈춤'으로 읽혀서 — 동작 이름(멈추기)으로
      const b = E('button', 'btn sm ' + (s.paused ? 'weak' : 'danger'), s.paused ? '다시 켜기' : '멈추기'); b.type = 'button';
      b.title = s.paused ? `${hmS(s.paused_at)} ${s.paused_by || ''} 멈춤`.trim() : '이 구매처 자동 결제를 멈춰요';
      b.onclick = () => pauseBtn(s.shop, name, !s.paused, b); h.append(b);
      const pct = L.day ? Math.min(100, s.today_krw / L.day * 100) : 0;
      const g = E('div', 'ab-gauge'); g.append(E('span', null, `오늘 ${won(s.today_krw)} / ${won(L.day)}`), E('span', null, `이번 달 ${won(s.month_krw)}`));
      const pb = E('div', 'p'); const bb = E('b'); bb.style.width = `${pct}%`; pb.append(bb);
      pb.setAttribute('role', 'meter'); pb.setAttribute('aria-label', `오늘 ${name} 결제 ${won(s.today_krw)}, 하루 한도 ${won(L.day)}`);
      c.append(h, g, pb);
      if (s.paused) c.append(E('div', 'sub', `${hmS(s.paused_at)} ${s.paused_by || ''} 멈춤`.trim()));
      const ul = E('ul');
      if (!s.recent.length) ul.append(E('li', 'muted', '아직 결제 기록이 없어요'));
      for (const p of s.recent) {
        const [t, cls] = PST[p.status] || [window.koLabel ? window.koLabel(p.status || '') : (p.status || ''), ''];
        const l = E('li'); l.append(E('span', 'badge ' + cls, t), E('span', 'num', `${hmS(p.at)} · ${won(p.krw)}` + (p.amount != null && p.currency && p.currency !== 'KRW' ? `(${p.currency} ${(+p.amount).toLocaleString('ko-KR', { maximumFractionDigits: 2 })})` : '')),
          document.createTextNode(p.shop_order ? ` · 주문 ${p.shop_order}` : ''));
        if (p.why) l.append(E('div', 'ab-why', whyTxt(p.why)));
        ul.append(l);
      }
      c.append(ul);
      if (s.plan.length) {
        const pu = E('ul'); pu.append(E('li', 'ab-ph', `승인 기다리는 재고 구매 ${s.plan.length}건`));
        for (const x of s.plan.slice(0, 6)) pu.append(E('li', null, planLine(x)));
        c.append(pu);
      }
      if (s.stock.length) c.append(E('div', 'sub', '최근 재고 구매: ' + s.stock.slice(0, 3).map((x) => `${noE(x.product || '')} ${x.qty || ''}개 ${window.koLabel ? window.koLabel(x.status || '') : (x.status || '')}`).join(' · ')));
      box.append(c);
    }
    $('ab-other').textContent = d.plan_other.length ? '구매처를 정하지 않은 재고 구매: ' + d.plan_other.map(planLine).join(' · ') : '';
  }
  // 2026-11-06: 자동 구매 자료를 못 읽으면 '불러오는 중'만 남아 켜짐·멈춤을 알 수 없었음 → 못 읽었다고, 이전 표시가 있으면 '마지막으로 읽은 상태'라고
  let buyOk = false;
  async function loadBuy() {
    try {
      const r = await (window.barunFetch || fetch)('/api/autobuy');
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      renderBuy(await r.json()); buyOk = true;
    } catch (e) {
      if (e.message === '로그인 필요') return;
      $('ab-lead').textContent = `자동 구매 상태를 읽지 못했어요(${e.message}).` + (buyOk ? ' 아래는 마지막으로 읽은 상태라 지금과 다를 수 있어요.' : ' 멈추려면 잠시 뒤 다시 열어 주세요.');
    }
  }

  async function load() {
    if (busy) return; busy = true;
    loadBuy();
    try {
      const r = await (window.barunFetch || fetch)('/api/automation');
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      render(await r.json());
    } catch (e) {
      if (e.message !== '로그인 필요' && !data) { $('au-title').textContent = '자동화 현황을 읽지 못했어요'; $('au-lead').textContent = `${e.message}. 잠시 뒤 다시 읽어요.`; }
    } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
