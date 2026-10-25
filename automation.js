// 자동화율 화면 — 완전 자동화 목표(사람 손 2% 미만)까지 어디쯤인지: 큰 숫자 → 흐름 띠(단계별 수준) → 단계 자세히 → 추이 → 로드맵·다음 할 일 → 새로 찾은 여지
// (2026-10-22 사장님: "파이프라인을 작업 단위로 쪼개 자동화 단계와 전체 자동화율을 한눈에"). 읽기: GET /api/automation(autoimprove/pipeline.py).
// '자동 구매' 영역(구매처별 켜짐·멈춤·한도·최근 결제 — GET /api/autobuy, [멈춤]/[다시 켜기]만 쓰기)은 dashboard/autobuy.py.
// 원본은 config/pipeline.toml — 화면은 보여 주기만. 자리: index.html에 미리 있는 화면(#p-…)을 채운다(보임·숨김은 'barun:page' 이벤트).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  // 수준 → 색(순서 있는 척도, 글자로도 함께 표시 — 색만으로 구분하지 않음)
  const LV = [['사람', 'var(--st-crit)'], ['자료만', 'var(--st-serious)'], ['반자동', 'var(--st-warn)'], ['자동', 'var(--st-run)'], ['완전 자동', 'var(--st-good)']];
  const ST = { done: ['', 'ok', '끝'], doing: ['', 'run', '진행 중'], todo: ['', '', '할 일'] };
  const noE = (t) => (window.noEmoji ? window.noEmoji(t) : String(t ?? ''));
  const mark = (st) => { const e = E('span', 'au-mk ' + (st || 'todo')); if (st === 'done') e.innerHTML = window.ico ? window.ico('check') : ''; return e; };   // 끝·진행·할 일 표시를 그림으로
  let timer = 0, busy = false, data = null, pick = null;

  function install() {
    const sec = $('p-auto'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      .au-meter { position: relative; height: 14px; border-radius: 7px; background: var(--fill); margin: 14px 0 6px; overflow: visible; }
      .au-meter > b { display: block; height: 100%; border-radius: 7px; background: var(--st-run); transition: width .4s; }
      .au-meter > i { position: absolute; top: -5px; bottom: -5px; width: 2px; background: var(--ink); border-radius: 1px; }
      .au-meter-l { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); }
      .au-flow { display: flex; gap: 6px; overflow-x: auto; padding: 4px 2px 10px; scroll-snap-type: x proximity; }
      .au-step { flex: 0 0 auto; width: 104px; min-height: 92px; border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--card);
        padding: 8px 10px; text-align: left; cursor: pointer; scroll-snap-align: start; position: relative; font: inherit; color: inherit; }
      .au-step:hover { background: var(--hover); } .au-step:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
      .au-step[aria-pressed="true"] { border-color: var(--blue); box-shadow: 0 0 0 1px var(--blue) inset; }
      .au-step .n { font-size: 11px; color: var(--muted); } .au-step .nm { font-size: 13px; font-weight: 600; line-height: 1.3; margin: 2px 0 6px; word-break: keep-all; }
      .au-step .lv { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--sub); }
      .au-step .lv i, .au-leg i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
      .au-step .pc { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 2px; }
      .au-step .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; border-radius: 0 0 var(--r-sm) var(--r-sm); }
      .au-leg { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--sub); }
      .au-leg span { display: inline-flex; align-items: center; gap: 5px; }
      .au-detail { margin-top: 10px; padding: 14px 16px; background: var(--fill2); border-radius: var(--r-sm); }
      .au-detail dl { display: grid; grid-template-columns: 76px 1fr; gap: 6px 10px; margin: 8px 0 0; font-size: 14px; }
      .au-detail dt { color: var(--muted); } .au-detail dd { margin: 0; }
      .au-trend { display: flex; align-items: flex-end; gap: 4px; height: 110px; position: relative; margin-top: 8px; }
      .au-trend > div > span:last-child { height: 14px; line-height: 14px; }
      .au-trend > div { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; font-size: 10px; color: var(--muted); }
      .au-trend b { display: block; width: 100%; max-width: 22px; background: var(--st-run); border-radius: 3px 3px 0 0; min-height: 2px; }
      .au-trend .goal { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--ink); font-size: 10px; color: var(--sub); }
      .au-phases { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
      .au-ph { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 10px 12px; background: var(--card); }
      .au-ph.now { border-color: var(--blue); background: var(--blue-bg); }
      .au-ph h3 { font-size: 14px; margin: 0 0 2px; } .au-ph .w { font-size: 12px; color: var(--muted); }
      .au-ph .g { font-size: 12px; color: var(--sub); margin: 6px 0; line-height: 1.4; }
      .au-ph .p { height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden; } .au-ph .p b { display: block; height: 100%; background: var(--st-good); }
      .au-ph ul { list-style: none; padding: 0; margin: 8px 0 0; font-size: 12px; } .au-ph li { padding: 2px 0; color: var(--sub); }
      .au-ph li.done { color: var(--muted); text-decoration: line-through; }
      .au-mk { display: inline-flex; width: 12px; height: 12px; margin-right: 5px; vertical-align: -1px; align-items: center; justify-content: center; }
      .au-mk.todo { border: 1.5px solid var(--muted); border-radius: 50%; width: 9px; height: 9px; } .au-mk.doing { background: var(--st-run); border-radius: 50%; width: 8px; height: 8px; }
      .au-mk.done { color: var(--st-good); }
      .ab-shops { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; }
      .ab-shop { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 12px 14px; background: var(--card); }
      .ab-shop.off { background: var(--fill2); }
      .ab-shop h3 { font-size: 15px; margin: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .ab-shop h3 button { margin-left: auto; }
      .ab-gauge { font-size: 12px; color: var(--sub); margin: 8px 0 2px; display: flex; justify-content: space-between; }
      .ab-shop .p { height: 6px; border-radius: 3px; background: var(--fill); overflow: hidden; } .ab-shop .p b { display: block; height: 100%; background: var(--st-run); }
      .ab-shop ul { list-style: none; padding: 0; margin: 8px 0 0; font-size: 12px; } .ab-shop li { padding: 3px 0; color: var(--sub); border-top: 1px solid var(--line); }
      .ab-shop li:first-child { border-top: 0; } .ab-shop .sub { font-size: 12px; color: var(--muted); margin-top: 8px; }
      @media (max-width: 900px) { .au-phases { grid-template-columns: 1fr; } }
      @media (max-width: 720px) { #au-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero"><h2 id="au-title">불러오는 중</h2><p class="lead" id="au-lead"></p>
        <div class="au-meter" id="au-meter" role="meter" aria-valuemin="0" aria-valuemax="100"><b></b><i></i></div>
        <div class="au-meter-l"><span>0%</span><span id="au-goal-l"></span></div>
        <div class="stats" id="au-stats" style="margin-top:14px"></div></div>
      <div class="card" id="ab-card"><div class="card-h"><h2>자동 구매</h2><span class="desc" id="ab-d">구매처별 결제 한도·최근 결제 · 멈추면 그 구매처는 결제하지 않아요</span></div>
        <p class="lead" id="ab-lead">불러오는 중</p><div class="ab-shops" id="ab-shops"></div>
        <div class="sub muted small" id="ab-other"></div></div>
      <div class="card"><div class="card-h"><h2 id="au-flow-h">업무 흐름</h2><span class="desc">숫자 = 7일간 실제로 사람 손 없이 지난 비율(그 단계를 지난 주문·일만) · 누르면 어떻게 쟀는지</span></div>
        <div class="au-leg" id="au-leg"></div><div class="au-flow" id="au-flow" role="group" aria-label="주문 흐름 단계"></div>
        <div class="au-detail" id="au-detail" aria-live="polite"></div></div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>지금 할 일</h2><span class="desc" id="au-next-d"></span></div><ul class="list" id="au-next"></ul></div>
        <div class="card"><div class="card-h"><h2>최근 14일 추이</h2><span class="desc">손 안 탄 비율 · 점선 목표</span></div><div class="au-trend" id="au-trend" role="img"></div></div>
      </div>
      <div class="card"><div class="card-h"><h2>로드맵 5단계</h2><span class="desc">파란 칸이 지금 단계</span></div><div class="au-phases" id="au-phases"></div></div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>사람 카드가 나온 곳</h2><span class="desc">최근 7일 #할-일</span></div><ul class="list" id="au-cards"></ul></div>
        <div class="card"><div class="card-h"><h2>새로 찾은 자동화 여지</h2><span class="desc">회차·에이전트가 찾은 것</span></div><ul class="list" id="au-ideas"></ul></div>
      </div>`;
    document.addEventListener('barun:page', (e) => { if (e.detail === 'auto') { load(); start(); } else stop(); });
    if (!sec.hidden) { load(); start(); }
    return true;
  }

  const start = () => { stop(); timer = setInterval(() => { if (!document.hidden && !$('p-auto').hidden) load(); }, 60000); };
  const stop = () => { if (timer) clearInterval(timer); timer = 0; };
  const stat = (k, v, d, cls) => { const s = E('div', 'stat ' + (cls || '')); s.style.cursor = 'default'; s.append(E('div', 'k', k), E('div', 'v', v), E('div', 'd', d || '')); return s; };
  const pctTxt = (p) => p == null ? '—' : `${p}%`;
  const empty = (ul, t) => { ul.innerHTML = ''; ul.append(E('li', 'muted small', t)); };
  function li(title, sub, badge, cls) {
    const l = E('li'); const r = E('div', 'row'); r.style.cursor = 'default';
    const b = E('div', 'row-body'); b.append(E('span', null, title)); if (sub) b.append(E('span', 'muted small', sub));
    r.append(b); if (badge) r.append(E('span', 'badge ' + (cls || ''), badge)); l.append(r); return l;
  }
  const ROLE = { orders: '주문·발송', mail: '메일·송장', pricing: '가격·위너', inquiry: '고객문의', close: '마감·분석', improve: '개선', infra: '인프라', sourcing: '소싱·원가' };

  function detail(s) {
    const d = $('au-detail'); d.innerHTML = '';
    const h = E('div'); h.append(E('strong', null, `${s.n}. ${s.name}`), document.createTextNode('  '), E('span', 'badge', `수준 ${s.level} · ${s.level_name}`));
    if (s.pct != null) h.append(document.createTextNode(' '), E('span', 'badge ' + (s.pct >= 98 ? 'ok' : s.pct >= 50 ? 'run' : 'warn'), `7일 ${s.auto}/${s.orders}${s.unit || '건'} 자동`));
    else h.append(document.createTextNode(' '), E('span', 'badge', '7일 동안 이 일 없음'));
    const dl = E('dl');
    for (const [k, v] of [['지금 방식', s.how], ['어떻게 쟀나', s.measure || ''], ['막힌 이유', s.blocker || '없음'], ['다음 단계', s.next || '유지']]) if (v) dl.append(E('dt', null, k), E('dd', null, noE(v)));
    d.append(h, dl);
    if (s.tasks && s.tasks.length) {
      const ul = E('ul', 'list'); ul.style.marginTop = '8px';
      for (const t of s.tasks) { const l = li(noE(t.title), `로드맵 ${t.phase}단계`, ST[t.state || 'todo'][2], ST[t.state || 'todo'][1]); l.querySelector('.row-body > span').prepend(mark(t.state)); ul.append(l); }
      d.append(ul);
    }
  }

  function render(d) {
    data = d;
    const p = d.pct ?? 0, goal = d.goal;
    const worst = d.stages.filter((s) => s.pct != null && s.orders && s.applies !== 'asks').sort((a, b) => a.pct - b.pct || b.orders - a.orders)[0];
    $('au-title').textContent = `사람 손 안 탄 주문 ${pctTxt(d.pct)} — 목표 ${goal}%`;
    $('au-lead').textContent = `최근 ${d.days}일 주문 ${d.orders}건 중 ${d.done - d.touched}건 전 과정 자동` +
      (worst ? ` · 가장 큰 막힘 ${worst.name}(${worst.auto}/${worst.orders})` : '');
    const m = $('au-meter'); m.querySelector('b').style.width = `${Math.min(100, p)}%`; m.querySelector('i').style.left = `${goal}%`;
    m.setAttribute('aria-valuenow', String(p)); m.setAttribute('aria-label', `사람 손 안 탄 주문 ${p}%, 목표 ${goal}%`);
    $('au-goal-l').textContent = `목표 ${goal}%`;
    const st = $('au-stats'); st.innerHTML = '';
    const ph = d.phases.find((x) => x.n === d.now_phase) || {};
    st.append(stat('최근 7일 주문', `${d.orders}`, Object.entries(d.mix).map(([k, v]) => `${k} ${v}`).join(' · ')),
      stat('사람 손 탄 주문', `${d.touched}`, d.pending ? `처리 방식 미정 ${d.pending}건 제외` : '', d.touched ? 'warn' : 'ok'),
      stat('주문 100건당 사람 카드', d.cards_per_100 == null ? '—' : `${d.cards_per_100}장`, `7일 카드 ${d.human_cards}장`, d.cards_per_100 > 2 ? 'warn' : 'ok'),
      stat('단계 평균 자동화 수준', `${d.level_avg}%`, '수준 0~4 평균', ''),
      stat('지금 로드맵', `${d.now_phase}단계`, `${ph.title || ''} · ${ph.done || 0}/${ph.total || 0}`, 'run'));
    const leg = $('au-leg'); leg.innerHTML = '';
    LV.forEach(([nm, c], i) => { const s = E('span'); const dot = E('i'); dot.style.background = c; s.append(dot, document.createTextNode(`${i} ${nm}`)); leg.append(s); });
    $('au-flow-h').textContent = `업무 흐름 ${d.stages.length}단계`;
    const fl = $('au-flow'); fl.innerHTML = '';
    if (!pick || !d.stages.some((s) => s.id === pick)) pick = (worst || d.stages[0]).id;
    for (const s of d.stages) {
      const b = E('button', 'au-step'); b.type = 'button'; b.setAttribute('aria-pressed', String(s.id === pick));
      b.setAttribute('aria-label', `${s.n}단계 ${s.name}, 수준 ${s.level} ${s.level_name}, 자동 ${pctTxt(s.pct)}`);
      const lv = E('span', 'lv'); const dot = E('i'); dot.style.background = LV[s.level][1]; lv.append(dot, document.createTextNode(s.level_name));
      const bar = E('span', 'bar'); bar.style.background = LV[s.level][1];
      b.append(E('div', 'n', `${s.n}`), E('div', 'nm', s.name), lv, E('div', 'pc', s.pct == null ? '없음' : `${s.pct}%`), bar);
      b.title = s.pct == null ? '최근 7일 동안 이 일이 없었어요' : `7일 ${s.orders}${s.unit || '건'} 중 자동 ${s.auto}${s.unit || '건'}${s.measure ? ` — ${s.measure}` : ''}`;
      b.onclick = () => { pick = s.id; fl.querySelectorAll('.au-step').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); detail(s); };
      fl.append(b);
    }
    detail(d.stages.find((s) => s.id === pick));
    const un = $('au-next'); un.innerHTML = ''; $('au-next-d').textContent = `${d.now_phase}단계 · ${ph.title || ''}`;
    if (!d.next.length) empty(un, '이 단계 끝');
    for (const t of d.next) { const l = li(noE(t.title), t.stage_name, ST[t.state || 'todo'][2], ST[t.state || 'todo'][1]); l.querySelector('.row-body > span').prepend(mark(t.state)); un.append(l); }
    const tr = $('au-trend'); tr.innerHTML = '';
    const g = E('div', 'goal', `목표 ${goal}%`); g.style.bottom = `${goal * 0.8 + 14}px`; tr.append(g);
    tr.setAttribute('aria-label', d.trend.map((t) => `${t.day.slice(5)} ${t.pct == null ? '주문 없음' : t.pct + '%'}`).join(', '));
    for (const t of d.trend) {
      const col = E('div'); col.title = `${t.day} 주문 ${t.n}건 · ${pctTxt(t.pct)}`;
      const b = E('b'); b.style.height = `${(t.pct || 0) * 0.8}px`; if (t.pct == null) b.style.background = 'var(--axis)';
      col.append(E('span', null, t.pct == null ? '' : String(Math.round(t.pct))), b, E('span', null, t.day.slice(8)));
      tr.append(col);
    }
    const ps = $('au-phases'); ps.innerHTML = '';
    for (const x of d.phases) {
      const c = E('div', 'au-ph' + (x.n === d.now_phase ? ' now' : ''));
      const pb = E('div', 'p'); const bb = E('b'); bb.style.width = `${x.total ? x.done / x.total * 100 : 0}%`; pb.append(bb);
      const ul = E('ul');
      for (const t of x.tasks) { const l = E('li', t.state === 'done' ? 'done' : ''); l.append(mark(t.state), document.createTextNode(noE(t.title))); ul.append(l); }
      c.append(E('h3', null, `${x.n}. ${x.title}`), E('div', 'w', `${x.when} · ${x.done}/${x.total}`), E('div', 'g', x.goal), pb, ul);
      ps.append(c);
    }
    const uc = $('au-cards'); uc.innerHTML = '';
    const cr = Object.entries(d.cards_by_role).sort((a, b) => b[1] - a[1]);
    if (!cr.length) empty(uc, '없음');
    for (const [r, n] of cr) uc.append(li(ROLE[r] || r || '기타', '', `${n}장`, n >= 10 ? 'warn' : ''));
    const ui = $('au-ideas'); ui.innerHTML = '';
    if (!d.ideas.length) empty(ui, '없음');
    const sn = Object.fromEntries(d.stages.map((s) => [s.id, s.name]));
    for (const i of d.ideas.slice(0, 12)) ui.append(li(noE(i.text), `${(i.at || '').slice(5, 16).replace('T', ' ')} · ${i.by || ''}`, sn[i.stage] || (i.stage ? i.stage : '공정'), ''));
  }

  // 자동 구매 — GET /api/autobuy(dashboard/autobuy.py), 멈춤·다시 켜기 POST /api/action {action:'autobuy_pause'|'autobuy_resume', key:구매처}
  const won = (n) => n == null ? '—' : `${Math.round(n).toLocaleString('ko-KR')}원`;
  const PST = { paid: ['결제됨', 'ok'], ready: ['결제 중', 'run'], blocked: ['막힘', 'warn'], failed: ['실패', 'bad'] };
  const hmS = (s) => (s || '').slice(5, 16).replace('T', ' ');
  async function pauseBtn(shop, pause, btn) {
    if (!confirm(pause ? `${shop} 자동 구매를 멈출까요? 다시 켤 때까지 결제하지 않아요.` : `${shop} 자동 구매를 다시 켤까요?`)) return;
    btn.disabled = true;
    try {
      const r = await (window.barunFetch || fetch)('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: pause ? 'autobuy_pause' : 'autobuy_resume', key: shop }) });
      const j = await r.json(); if (window.toast) window.toast((j.ok ? '' : '실패: ') + j.msg); loadBuy();
    } catch (e) { if (window.toast) window.toast('실패: ' + e.message); } finally { btn.disabled = false; }
  }
  function planLine(x) {
    return `${noE(x.product || '')}${x.option ? ' ' + noE(x.option) : ''} ${x.qty || ''}개` + (x.max_krw ? ` · 최대 ${won(x.max_krw)}` : x.unit_krw ? ` · 개당 ${won(x.unit_krw)}` : '');
  }
  function renderBuy(d) {
    const L = d.limits || {};
    const off = d.shops.filter((s) => s.paused).length, bad = d.shops.reduce((a, s) => a + (s.bad || 0), 0);
    const wait = d.plan.length;
    $('ab-lead').textContent = `오늘 쓴 돈 ${won(d.today_krw)} / 하루 한도 ${won(L.day)} · 건당 한도 ${won(L.order)}` +
      ` · 멈춘 구매처 ${off}곳 · 최근 막힘·실패 ${bad}건` + (wait ? ` · 승인 기다리는 재고 구매 ${wait}건` : '');
    const box = $('ab-shops'); box.innerHTML = '';
    for (const s of d.shops) {
      const c = E('div', 'ab-shop' + (s.paused ? ' off' : ''));
      const h = E('h3', null, s.shop);
      h.append(E('span', 'badge ' + (s.paused ? 'warn' : 'ok'), s.paused ? '멈춤' : '켜짐'),
        E('span', 'badge ' + (s.confirmed ? 'ok' : ''), s.confirmed ? '첫 결제 확인됨' : '첫 결제 확인 전'));
      const b = E('button', 'btn xs ' + (s.paused ? 'weak' : 'danger'), s.paused ? '다시 켜기' : '멈춤'); b.type = 'button';
      b.title = s.paused ? `${s.paused_by || ''} ${hmS(s.paused_at)} 멈춤` : '이 구매처 자동 결제를 멈춰요';
      b.onclick = () => pauseBtn(s.shop, !s.paused, b); h.append(b);
      const pct = L.day ? Math.min(100, s.today_krw / L.day * 100) : 0;
      const g = E('div', 'ab-gauge'); g.append(E('span', null, `오늘 ${won(s.today_krw)} / ${won(L.day)}`), E('span', null, `이번 달 ${won(s.month_krw)}`));
      const pb = E('div', 'p'); const bb = E('b'); bb.style.width = `${pct}%`; pb.append(bb);
      pb.setAttribute('role', 'meter'); pb.setAttribute('aria-label', `오늘 ${s.shop} 결제 ${won(s.today_krw)}, 하루 한도 ${won(L.day)}`);
      c.append(h, g, pb);
      if (s.paused) c.append(E('div', 'sub', `${s.paused_by || ''} ${hmS(s.paused_at)} 멈춤`));
      if (!s.confirmed) c.append(E('div', 'sub', '첫 자동 결제는 사장님 [결제] 버튼 확인 뒤에 해요'));
      const ul = E('ul');
      if (!s.recent.length) ul.append(E('li', 'muted', '결제 기록 없음'));
      for (const p of s.recent) {
        const [t, cls] = PST[p.status] || [p.status || '', ''];
        const l = E('li'); l.append(E('span', 'badge ' + cls, t), document.createTextNode(` ${hmS(p.at)} ${won(p.krw)}` + (p.amount != null ? ` (${p.currency} ${p.amount})` : '') +
          (p.shop_order ? ` · 주문 ${p.shop_order}` : '') + (p.why ? ` — ${noE(p.why)}` : '')));
        ul.append(l);
      }
      c.append(ul);
      if (s.plan.length) {
        const pu = E('ul'); pu.append(E('li', null, `승인 기다리는 재고 구매 ${s.plan.length}건`));
        for (const x of s.plan.slice(0, 6)) pu.append(E('li', null, planLine(x)));
        c.append(pu);
      }
      if (s.stock.length) c.append(E('div', 'sub', '최근 재고 구매: ' + s.stock.slice(0, 3).map((x) => `${noE(x.product || '')} ${x.qty || ''}개 ${x.status || ''}`).join(' · ')));
      box.append(c);
    }
    $('ab-other').textContent = d.plan_other.length ? '구매처 미정 재고 구매: ' + d.plan_other.map(planLine).join(' · ') : '';
  }
  async function loadBuy() {
    try { const r = await (window.barunFetch || fetch)('/api/autobuy'); if (r.ok) renderBuy(await r.json()); }
    catch (e) { /* 토큰 창은 barunFetch가 띄움 */ }
  }

  async function load() {
    if (busy) return; busy = true;
    loadBuy();
    try { const r = await (window.barunFetch || fetch)('/api/automation'); if (r.ok) render(await r.json()); }
    catch (e) { /* 토큰 창은 barunFetch가 띄움 */ } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
