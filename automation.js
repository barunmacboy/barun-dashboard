// 🚀 자동화 탭 — 완전 자동화 목표(사람 손 2% 미만)까지 어디쯤인지: 큰 숫자 → 흐름 띠(단계별 수준) → 단계 자세히 → 추이 → 로드맵·다음 할 일 → 새로 찾은 여지
// (2026-10-22 사장님: "파이프라인을 작업 단위로 쪼개 자동화 단계와 전체 자동화율을 한눈에"). 읽기: GET /api/automation(autoimprove/pipeline.py).
// 원본은 config/pipeline.toml — 화면은 보여 주기만. index.html을 고치지 않고 스스로 탭 버튼·패널을 붙인다(sourcing.js와 같은 방식).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  // 수준 → 색(순서 있는 척도, 글자로도 함께 표시 — 색만으로 구분하지 않음)
  const LV = [['사람', 'var(--st-crit)'], ['자료만', 'var(--st-serious)'], ['반자동', 'var(--st-warn)'], ['자동', 'var(--st-run)'], ['완전 자동', 'var(--st-good)']];
  const ST = { done: ['✓', 'ok', '끝'], doing: ['●', 'run', '진행 중'], todo: ['○', '', '할 일'] };
  let timer = 0, busy = false, data = null, pick = null;

  function install() {
    if ($('p-auto') || typeof TABS === 'undefined') return false;
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
      @media (max-width: 900px) { .au-phases { grid-template-columns: 1fr; } }
      @media (max-width: 720px) { #au-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;
    document.head.append(css);
    const nav = document.querySelector('.tabs');
    const btn = E('button', 'tab', '🚀 자동화'); btn.type = 'button';
    Object.assign(btn.dataset, { tab: 'auto' }); btn.setAttribute('role', 'tab'); btn.setAttribute('aria-controls', 'p-auto');
    nav.insertBefore(btn, nav.querySelector('[data-tab="work"]'));
    const sec = E('section', 'panel'); sec.id = 'p-auto'; sec.setAttribute('role', 'tabpanel'); sec.setAttribute('aria-label', '자동화'); sec.hidden = true;
    sec.innerHTML = `
      <div class="card hero"><h2 id="au-title">불러오는 중이에요</h2><p class="lead" id="au-lead"></p>
        <div class="au-meter" id="au-meter" role="meter" aria-valuemin="0" aria-valuemax="100"><b></b><i></i></div>
        <div class="au-meter-l"><span>0%</span><span id="au-goal-l"></span></div>
        <div class="stats" id="au-stats" style="margin-top:14px"></div></div>
      <div class="card"><div class="card-h"><h2 id="au-flow-h">업무 흐름</h2><span class="desc">칸을 누르면 지금 방식·막힌 이유·다음 할 일이 보여요. 숫자 = 최근 7일 그 단계를 사람 손 없이 지난 주문 비율(보낸 문의는 답을 자동으로 확인하는 비율).</span></div>
        <div class="au-leg" id="au-leg"></div><div class="au-flow" id="au-flow" role="group" aria-label="주문 흐름 단계"></div>
        <div class="au-detail" id="au-detail" aria-live="polite"></div></div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>지금 할 일</h2><span class="desc" id="au-next-d"></span></div><ul class="list" id="au-next"></ul></div>
        <div class="card"><div class="card-h"><h2>최근 14일 추이</h2><span class="desc">날마다 사람 손 안 탄 주문 비율 · 점선 = 목표</span></div><div class="au-trend" id="au-trend" role="img"></div></div>
      </div>
      <div class="card"><div class="card-h"><h2>로드맵 5단계</h2><span class="desc">파란 칸이 지금 단계예요. 태스크가 다 끝나면 다음 단계로 넘어가요.</span></div><div class="au-phases" id="au-phases"></div></div>
      <div class="grid2">
        <div class="card"><div class="card-h"><h2>사람 카드가 나온 곳</h2><span class="desc">최근 7일 #할-일 카드 — 많은 곳부터 줄여요</span></div><ul class="list" id="au-cards"></ul></div>
        <div class="card"><div class="card-h"><h2>새로 찾은 자동화 여지</h2><span class="desc">회차 점검·에이전트가 찾을 때마다 쌓여요</span></div><ul class="list" id="au-ideas"></ul></div>
      </div>`;
    document.querySelector('main').append(sec);
    TABS.splice(TABS.indexOf('work'), 0, 'auto');
    const orig = window.showTab;
    window.showTab = function (name, push) { orig(name, push); if (name === 'auto') { load(); start(); } else stop(); };
    btn.onclick = () => window.showTab('auto');
    let want = location.hash.slice(1); try { want = want || localStorage.getItem('barun.tab') || ''; } catch (e) { /* 무시 */ }
    if (want === 'auto') window.showTab('auto', false);
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
  const ROLE = { orders: '📦 주문·발송', mail: '✉️ 메일·송장', pricing: '💰 가격·위너', inquiry: '💬 고객문의', close: '📊 마감·분석', improve: '🛠 개선', infra: '⚙️ 인프라', sourcing: '🔎 소싱·원가' };

  function detail(s) {
    const d = $('au-detail'); d.innerHTML = '';
    const h = E('div'); h.append(E('strong', null, `${s.n}. ${s.name}`), document.createTextNode('  '), E('span', 'badge', `수준 ${s.level} · ${s.level_name}`));
    if (s.pct != null) h.append(document.createTextNode(' '), E('span', 'badge ' + (s.pct >= 98 ? 'ok' : s.pct >= 50 ? 'run' : 'warn'), `7일 ${s.auto}/${s.orders}건 자동`));
    const dl = E('dl');
    for (const [k, v] of [['지금 방식', s.how], ['막힌 이유', s.blocker || '없음'], ['다음 단계', s.next || '이대로 유지']]) dl.append(E('dt', null, k), E('dd', null, v));
    d.append(h, dl);
    if (s.tasks && s.tasks.length) {
      const ul = E('ul', 'list'); ul.style.marginTop = '8px';
      for (const t of s.tasks) ul.append(li(`${ST[t.state || 'todo'][0]} ${t.title}`, `로드맵 ${t.phase}단계`, ST[t.state || 'todo'][2], ST[t.state || 'todo'][1]));
      d.append(ul);
    }
  }

  function render(d) {
    data = d;
    const p = d.pct ?? 0, goal = d.goal;
    const worst = d.stages.filter((s) => s.pct != null && s.orders && s.applies !== 'asks').sort((a, b) => a.pct - b.pct || b.orders - a.orders)[0];
    $('au-title').textContent = `사람 손 안 탄 주문 ${pctTxt(d.pct)} — 목표 ${goal}%`;
    $('au-lead').textContent = `최근 ${d.days}일 주문 ${d.orders}건 중 ${d.done - d.touched}건이 처음부터 끝까지 자동이었어요.` +
      (worst ? ` 가장 큰 막힘은 '${worst.name}'(${worst.orders}건 중 자동 ${worst.auto}건)이에요.` : '');
    const m = $('au-meter'); m.querySelector('b').style.width = `${Math.min(100, p)}%`; m.querySelector('i').style.left = `${goal}%`;
    m.setAttribute('aria-valuenow', String(p)); m.setAttribute('aria-label', `사람 손 안 탄 주문 ${p}%, 목표 ${goal}%`);
    $('au-goal-l').textContent = `목표 ${goal}% ▸`;
    const st = $('au-stats'); st.innerHTML = '';
    const ph = d.phases.find((x) => x.n === d.now_phase) || {};
    st.append(stat('최근 7일 주문', `${d.orders}`, Object.entries(d.mix).map(([k, v]) => `${k} ${v}`).join(' · ')),
      stat('사람 손 탄 주문', `${d.touched}`, d.pending ? `처리 방식 미정 ${d.pending}건 제외` : '', d.touched ? 'warn' : 'ok'),
      stat('주문 100건당 사람 카드', d.cards_per_100 == null ? '—' : `${d.cards_per_100}장`, `7일 카드 ${d.human_cards}장`, d.cards_per_100 > 2 ? 'warn' : 'ok'),
      stat('단계 평균 자동화 수준', `${d.level_avg}%`, '14단계 수준(0~4)의 평균', ''),
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
      b.append(E('div', 'n', `${s.n}`), E('div', 'nm', s.name), lv, E('div', 'pc', s.pct == null ? '·' : `${s.pct}%`), bar);
      b.title = s.pct == null ? '주문 단위가 아닌 업무' : `7일 ${s.orders}건 중 자동 ${s.auto}건`;
      b.onclick = () => { pick = s.id; fl.querySelectorAll('.au-step').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); detail(s); };
      fl.append(b);
    }
    detail(d.stages.find((s) => s.id === pick));
    const un = $('au-next'); un.innerHTML = ''; $('au-next-d').textContent = `${d.now_phase}단계 · ${ph.title || ''} — ${ph.goal || ''}`;
    if (!d.next.length) empty(un, '이 단계 태스크를 다 끝냈어요');
    for (const t of d.next) un.append(li(`${ST[t.state || 'todo'][0]} ${t.title}`, t.stage_name, ST[t.state || 'todo'][2], ST[t.state || 'todo'][1]));
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
      for (const t of x.tasks) { const l = E('li', t.state === 'done' ? 'done' : '', `${ST[t.state || 'todo'][0]} ${t.title}`); ul.append(l); }
      c.append(E('h3', null, `${x.n}. ${x.title}`), E('div', 'w', `${x.when} · ${x.done}/${x.total}`), E('div', 'g', x.goal), pb, ul);
      ps.append(c);
    }
    const uc = $('au-cards'); uc.innerHTML = '';
    const cr = Object.entries(d.cards_by_role).sort((a, b) => b[1] - a[1]);
    if (!cr.length) empty(uc, '최근 7일 사람 카드가 없어요');
    for (const [r, n] of cr) uc.append(li(ROLE[r] || r || '기타', '', `${n}장`, n >= 10 ? 'warn' : ''));
    const ui = $('au-ideas'); ui.innerHTML = '';
    if (!d.ideas.length) empty(ui, '아직 쌓인 여지가 없어요');
    const sn = Object.fromEntries(d.stages.map((s) => [s.id, s.name]));
    for (const i of d.ideas.slice(0, 12)) ui.append(li(i.text, `${(i.at || '').slice(5, 16).replace('T', ' ')} · ${i.by || ''}`, sn[i.stage] || (i.stage ? i.stage : '공정'), ''));
  }

  async function load() {
    if (busy) return; busy = true;
    try { const r = await (window.barunFetch || fetch)('/api/automation'); if (r.ok) render(await r.json()); }
    catch (e) { /* 토큰 창은 barunFetch가 띄움 */ } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
