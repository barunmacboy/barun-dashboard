// 설정 화면 — 코드를 고치지 않고 바꾸는 값 한 곳(2026-11-12 사장님: "지금 사용하는 모든 하드코딩된 값을 … 설정 페이지에서 편하게 바꿀 수 있게",
// 같은 날 "도움말도 대거 잘 추가하고 UIUX 잘 다듬고"). 읽기: GET /api/settings(barun/views/settings.snapshot) ·
// 바꾸기: POST /api/action {action:'settings', op:'set'|'reset'|'pause'|'resume', key, value}.
// 목록 원본은 config/settings.toml(설명 help · 바꾸면 effect · 바깥에 쓰는 스위치 risk · 묶음 설명 group_help) + 예약 업무(jobs/jobs.toml).
// 화면은 칸 종류(kind)만 보고 그린다. 비밀번호·카드번호는 받지 않는다. 바깥에 쓰는 스위치(risk)는 두 번 눌러야 저장.
// 쿠팡 계정 카드(2026-11-12 사장님 '다른 쿠팡 계정에도 상품을 올릴 수 있게'): 계정마다 준비 상태·[여기에 올리기](설정 account.coupang_register)·
// [연결 확인](op acct_check — 그 계정 키로 쿠팡 GET만)·계정 정보(op acct_save — 반품지·출고지는 연결 확인이 읽은 목록에서만). 키는 화면에서 받지 않는다(터미널 명령 안내).
// 자리: index.html에 미리 있는 화면(#p-settings)을 채운다(보임·숨김은 'barun:page' 이벤트).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const NUM = ['int', 'money', 'pct', 'float', 'minutes'];
  const DOMAIN = { orders: '주문·발송·배대지', mail: '메일·송장', pricing: '가격·위너·판매', inquiry: '고객문의', close: '마감', improve: '자가개선',
    infra: '인프라·감시', sourcing: '소싱·등록' };
  const MODEL = { 'claude-opus-5-5': 'Opus 5.5 · 가장 꼼꼼', 'claude-sonnet-5-5': 'Sonnet 5.5 · 보통', 'claude-haiku-5-5': 'Haiku 5.5 · 빠르고 저렴', 'claude-fable-5-1': 'Fable 5.1' };
  const EFFORT = { low: '가볍게', medium: '보통', high: '깊게' };
  const optName = (c) => MODEL[c] || EFFORT[c] || String(c) || '바른청년(기본)';
  const when = (at) => String(at || '').slice(5, 16).replace('T', ' ');
  let D = null, busy = false, q = '', grp = '', onlyChanged = false;
  const openJobs = new Set(), openAcct = new Set(), acctMsg = new Map();   // 계정마다 마지막 결과 글(다시 그려도 남게)
  const ACCT_GROUP = '판매 수수료·계정', ACCT_KEY = 'account.coupang_register';
  // 쿠팡 등록 계정은 '소싱·등록'에서도 고름(2026-11-13 사장님 '자동 등록 계정도 설정에서 선택 가능하게') — 같은 설정 하나, 계정 카드의 [여기에 올리기]와 같음
  const AUTO_GROUP = '소싱·등록';
  const inGroup = (it, g) => it.key === ACCT_KEY ? g === AUTO_GROUP : it.group === g;
  const acctName = (c) => ((D.accounts || []).find((a) => a.name === c) || {}).label || c || '바른청년';
  const COUNTRY = { DE: '독일', US: '미국', AU: '호주', FR: '프랑스', NZ: '뉴질랜드', JP: '일본', IT: '이탈리아', ES: '스페인', GB: '영국', CA: '캐나다', KR: '한국' };

  function install() {
    const sec = $('p-settings'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      #p-settings { display: grid; gap: 14px; }
      .st-sticky { position: sticky; top: calc(var(--bar-h) + 6px); z-index: 5; box-shadow: 0 6px 20px rgba(16, 24, 40, .06); }
      @media (max-width: 1023px) { .st-sticky { top: calc(var(--bar-h) + 4px); padding: 12px; } }
      /* 휴대폰: 묶음 칩이 네 줄로 늘어 붙어 있는 찾기 판이 화면 1/3을 가리던 것(2026-11-13) → 칩은 한 줄로 옆으로 넘김 */
      @media (max-width: 720px) { #st-groups { flex-wrap: nowrap; overflow-x: auto; margin: 10px -12px 0 !important; padding: 0 12px; scroll-padding-inline: 12px; }
        #st-groups .st-chip { flex: none; white-space: nowrap; } }
      .st-bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .st-bar input[type=search] { font: inherit; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--ink); flex: 1 1 240px; min-width: 0; }
      .st-chip { font: inherit; font-size: 13px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--line); background: var(--card); color: var(--sub); cursor: pointer; }
      .st-chip[aria-pressed="true"] { background: var(--ink); color: var(--card); border-color: var(--ink); }
      .st-chip .n { opacity: .7; margin-left: 4px; font-variant-numeric: tabular-nums; }
      .st-guide { font-size: 13.5px; color: var(--sub); line-height: 1.6; } .st-guide summary { cursor: pointer; color: var(--ink); font-weight: 600; }
      .st-guide ul { margin: 8px 0 0; padding-left: 18px; } .st-guide li { margin: 3px 0; }
      .st-gdesc { font-size: 13px; color: var(--sub); margin: -4px 0 6px; line-height: 1.5; }
      .st-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 320px); gap: 14px; padding: 13px 2px; border-top: 1px solid var(--line); align-items: start; }
      .st-row:first-of-type { border-top: 0; } .st-row.dirty { background: var(--fill2); border-radius: var(--r-sm); padding-left: 8px; padding-right: 8px; }
      .st-l b { font-size: 14px; } .st-l .badge { margin-left: 6px; vertical-align: 1px; }
      .st-risk { font-size: 11.5px; padding: 1px 7px; border-radius: 999px; border: 1px solid var(--st-serious, #c2410c); color: var(--st-serious, #c2410c); margin-left: 6px; }
      .st-l { word-break: keep-all; overflow-wrap: anywhere; }   /* 한글 낱말 중간에서 줄이 안 바뀌게 */
      .st-help { font-size: 13px; color: var(--sub); margin-top: 4px; line-height: 1.5; }
      .st-eff { font-size: 12.5px; color: var(--sub); margin-top: 3px; line-height: 1.5; } .st-eff::before { content: '↳ '; color: var(--muted); }
      .st-def { font-size: 12px; color: var(--muted); margin-top: 4px; }
      .st-v { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; justify-content: flex-end; }
      .st-v input, .st-v select, .st-v textarea { font: inherit; font-size: 13.5px; padding: 7px 9px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--ink); min-width: 0; }
      .st-v input.n { width: 130px; text-align: right; font-variant-numeric: tabular-nums; } .st-v input.t { flex: 1 1 200px; }
      .st-v textarea { flex: 1 1 100%; min-height: 76px; resize: vertical; line-height: 1.5; }
      .st-u { font-size: 13px; color: var(--sub); }
      .st-msg { flex: 1 1 100%; text-align: right; font-size: 12.5px; color: var(--sub); } .st-msg:empty { display: none; } .st-msg.bad { color: var(--st-crit, #b91c1c); }
      .st-dom { margin: 14px 0 2px; font-size: 12.5px; color: var(--muted); font-weight: 600; letter-spacing: .02em; }
      .st-job { border-top: 1px solid var(--line); } .st-job > summary { list-style: none; cursor: pointer; padding: 11px 2px 11px 20px; position: relative; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .st-job > summary::-webkit-details-marker { display: none; }
      .st-job > summary::before { content: '›'; color: var(--sub); position: absolute; left: 4px; top: 8px; font-size: 18px; line-height: 1; transition: transform .18s var(--ease, ease); } .st-job[open] > summary::before { transform: rotate(90deg); }
      .st-job b { font-size: 14px; } .st-job .sum { font-size: 12.5px; color: var(--sub); margin-left: auto; font-variant-numeric: tabular-nums; }
      .st-job .jd { font-size: 12.5px; color: var(--sub); line-height: 1.5; padding: 0 2px 6px 22px; }
      .st-job .st-row { padding-left: 22px; border-top: 0; }
      .st-tbl { width: 100%; border-collapse: collapse; font-size: 13px; } .st-tbl td, .st-tbl th { padding: 7px 6px; border-top: 1px solid var(--line); text-align: left; vertical-align: top; }
      .st-tbl th { color: var(--muted); font-weight: 600; } .st-tbl td.v, .st-tbl td.t { white-space: nowrap; }
      .st-links { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); align-items: stretch; }
      .st-link { display: flex; flex-direction: column; justify-content: flex-start; gap: 3px; text-align: left; font: inherit; padding: 10px 12px; border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--fill2); color: var(--ink); cursor: pointer; }
      .st-link span { font-size: 12.5px; color: var(--sub); }
      .ac-list { display: grid; gap: 10px; }
      .ac { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 12px 14px; background: var(--card); }
      .ac.on { border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink) inset; }
      .ac-h { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .ac-h b { font-size: 15px; } .ac-h .sp { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; }
      .ac-ok { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: var(--fill2); color: var(--st-good, #15803d); }
      .ac-no { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: var(--fill2); color: var(--st-serious, #c2410c); }
      .ac .st-msg { text-align: left; }   /* 결과 글은 계정 정보 바로 아래 왼쪽에 */
      .ac-m { font-size: 13px; color: var(--sub); margin-top: 6px; line-height: 1.55; }
      .ac-todo { margin: 6px 0 0; padding-left: 18px; font-size: 13px; color: var(--st-serious, #c2410c); } .ac-todo li { margin: 2px 0; }
      .ac-f { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 8px 12px; margin-top: 10px; align-items: center; font-size: 13px; }
      .ac-f label { color: var(--sub); } .ac-f input, .ac-f select { font: inherit; font-size: 13.5px; padding: 7px 9px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--ink); min-width: 0; width: 100%; }
      .ac-f .hint { grid-column: 2; font-size: 12px; color: var(--muted); margin-top: -4px; }
      .ac-places { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px; }
      .ac-places div { display: flex; gap: 6px; align-items: center; } .ac-places span { width: 58px; color: var(--sub); flex: none; }
      .ac-new { margin-top: 12px; border-style: dashed; } .ac-new .ac-f { max-width: 620px; } .ac-new .st-msg { text-align: left; }
      .ac-steps { margin: 8px 0 2px; padding-left: 20px; font-size: 13px; color: var(--sub); line-height: 1.6; } .ac-steps a { color: inherit; text-decoration: underline; font-weight: 600; }
      .ac-key { display: flex; gap: 6px; align-items: center; } .ac-key input { flex: 1 1 auto; }
      @media (max-width: 720px) { .ac-f { grid-template-columns: 1fr; } .ac-f .hint { grid-column: 1; } .ac-h .sp { margin-left: 0; } .st-row { grid-template-columns: 1fr; gap: 8px; } .st-v { justify-content: flex-start; } .st-msg { text-align: left; } .st-job .sum { margin-left: 22px; flex-basis: 100%; } }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero"><h2 id="st-title">불러오는 중</h2><p class="lead">한도, 기준 시간, 자동 처리 스위치, 예약 시각을 여기서 바꿔요. 저장하면 10초 안에 모든 업무에 반영돼요.</p>
        <div class="stats" id="st-stats"></div>
        <details class="st-guide" id="st-guide"><summary>어떻게 쓰나요</summary><ul>
          <li><b>바꾸기</b>: 칸을 고치면 <b>저장</b> 버튼이 켜져요. 엔터로 저장하고 Esc로 되돌려요. 결과는 그 줄 아래에 나와요.</li>
          <li><b>기본값</b>: 칸마다 원래 값이 적혀 있어요. 바꾼 칸에는 <b>기본값으로</b> 버튼이 생기고, 누가 언제 바꿨는지는 아래 '바꾼 기록'에 남아요.</li>
          <li><b>바깥에 써요</b>: 결제, 등록, 고객 답변, 자동 승인처럼 쿠팡·네이버·구매처에 실제로 쓰는 설정이에요. 실수하지 않게 두 번 눌러야 저장돼요.</li>
          <li><b>예약 업무</b>: 업무 이름을 누르면 시각, 주기, 모델이 펼쳐져요. 시각을 바꾸면 그 업무만 다시 예약하고, 도는 중이면 끝난 뒤에 예약해요. 잠깐 쉬게 하려면 <b>멈춤</b>을 눌러 주세요.</li>
          <li><b>지침에 적힌 숫자</b>(48시간, 5일, 하루 10줄 같은 것)는 기본값이에요. 에이전트는 판단하기 전에 여기서 지금 값을 확인하고, 직접 바꾸지는 않아요.</li>
          <li>비밀번호와 카드번호는 여기 넣지 않아요. 카드는 결제 화면에 끝 4자리만 적고, 사이트 로그인은 사장님이 직접 해요. 쿠팡 계정 키는 아래 쿠팡 계정 카드에서만 넣어요.</li>
        </ul></details></div>
      <div class="card st-sticky"><div class="st-bar"><input id="st-q" type="search" placeholder="설정 찾기 (한도, 위너, 소싱, 시각, 모델)" aria-label="설정 찾기"></div>
        <div class="st-bar" id="st-groups" style="margin-top:10px"></div></div>
      <div class="card" id="st-links-card" hidden><div class="card-h"><h2>다른 화면에서 바꾸는 설정</h2><span class="desc">원본이 그 화면에 있어요</span></div><div class="st-links" id="st-links"></div></div>
      <div id="st-body" style="display:grid;gap:14px"></div>
      <div class="card"><div class="card-h"><h2>바꾼 기록</h2><span class="desc">최근 50개</span></div><div id="st-hist"></div></div>`;
    $('st-q').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); body(); });
    document.addEventListener('barun:page', (e) => { if (e.detail === 'settings') load(); });
    if (!sec.hidden) load();
    return true;
  }

  const stat = (k, v, d) => { const s = E('div', 'stat'); s.style.cursor = 'default'; s.append(E('div', 'k', k), E('div', 'v', v), E('div', 'd', d || '')); return s; };

  async function post(body, el, msg) {
    if (el) el.disabled = true;
    try {
      const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'settings', ...body }) });
      const j = await r.json();
      if (msg) { msg.textContent = j.msg || ''; msg.className = 'st-msg' + (j.ok ? '' : ' bad'); }
      if (window.toast) window.toast(j.msg);
      if (j.ok) setTimeout(load, 900);       // 결과 글을 잠깐 보여 준 뒤 다시 그림
      return j;
    } catch (e) { if (msg) { msg.textContent = '저장하지 못했어요. 연결을 확인해 주세요'; msg.className = 'st-msg bad'; } return null; }
    finally { if (el) el.disabled = false; }
  }

  const shown = (it, v) => Array.isArray(v) ? v.join(it.kind === 'list' ? '\n' : ', ') : it.kind === 'money' ? Number(v || 0).toLocaleString('ko-KR') : String(v ?? '');

  function input(it, row) {
    const box = E('div', 'st-v'), msg = E('div', 'st-msg');
    let armed = 0;
    const save = (v, el) => {
      if (it.risk && Date.now() - armed > 4000) {          // 바깥에 쓰는 스위치 — 4초 안에 한 번 더
        armed = Date.now(); msg.className = 'st-msg bad'; msg.textContent = '바깥에 실제로 쓰는 설정이에요. 맞으면 4초 안에 한 번 더 눌러 주세요';
        if (el && el.tagName === 'BUTTON') { const t = el.textContent; el.textContent = '한 번 더 눌러 확정'; setTimeout(() => { el.textContent = t; }, 4000); }
        return null;
      }
      armed = 0; return post({ op: 'set', key: it.key, value: v }, el, msg);
    };
    if (it.kind === 'bool' || it.kind === 'choice') {
      const s = E('select');
      if (it.kind === 'bool') s.append(new Option('켬', '1'), new Option('끔', '0'));
      else for (const c of it.choices) s.append(new Option(it.key === ACCT_KEY ? acctName(c) : optName(c), c));
      const cur = it.kind === 'bool' ? (it.value ? '1' : '0') : it.value;
      s.value = cur; s.setAttribute('aria-label', it.label);
      const b = E('button', 'btn sm', '저장'); b.type = 'button'; b.disabled = true;
      const val = () => (it.kind === 'bool' ? s.value === '1' : s.value);
      s.onchange = () => { b.disabled = s.value === cur; row.className = 'st-row' + (b.disabled ? '' : ' dirty'); if (!it.risk && !b.disabled) save(val(), s); };
      b.onclick = () => save(val(), b);
      box.append(s); if (it.risk) box.append(b);   // 바깥에 쓰는 스위치만 [저장] 두 번, 나머지는 고르면 바로 저장
    } else {
      const multi = it.kind === 'list';
      const f = E(multi ? 'textarea' : 'input', NUM.includes(it.kind) ? 'n' : 't');
      const orig = shown(it, it.value);
      f.value = orig;
      if (NUM.includes(it.kind)) f.inputMode = 'decimal';
      f.placeholder = multi ? '한 줄에 하나' : it.kind === 'times' ? '08:30, 18:30' : '';
      f.setAttribute('aria-label', it.label);
      const b = E('button', 'btn sm', '저장'); b.type = 'button'; b.disabled = true;
      const dirty = () => { b.disabled = f.value === orig; row.className = 'st-row' + (b.disabled ? '' : ' dirty'); };
      f.addEventListener('input', dirty);
      f.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { f.value = orig; dirty(); msg.textContent = ''; }
        else if (e.key === 'Enter' && !multi && !b.disabled) save(f.value, b);
      });
      b.onclick = () => save(f.value, b);
      const unit = it.unit || (it.kind === 'money' ? '원' : '');
      box.append(f); if (unit) box.append(E('span', 'st-u', unit)); box.append(b);
    }
    if (it.changed) { const r = E('button', 'btn sm ghost', '기본값으로'); r.type = 'button'; r.title = `기본값 ${it.show_default}`; r.onclick = () => post({ op: 'reset', key: it.key }, r, msg); box.append(r); }
    box.append(msg);
    return box;
  }

  function row(it) {
    const d = E('div', 'st-row'); d.dataset.key = it.key;
    const l = E('div', 'st-l'), h = E('div'); h.append(E('b', '', it.label));
    if (it.changed) h.append(E('span', 'badge', '바꿈'));
    if (it.risk) { const r = E('span', 'st-risk', '바깥에 써요'); r.title = '쿠팡·네이버·구매처에 실제로 쓰는 설정이라 두 번 눌러야 저장돼요'; h.append(r); }
    l.append(h);
    if (it.help) l.append(E('div', 'st-help', it.help));
    if (it.effect) l.append(E('div', 'st-eff', it.effect));
    l.append(E('div', 'st-def', [`기본값 ${it.show_default}`, it.changed && it.by ? `${it.by} · ${when(it.at)} 바꿈` : ''].filter(Boolean).join(' · ')));
    if (it.used) l.title = `쓰는 곳: ${it.used}`;
    d.append(l, input(it, d));
    return d;
  }

  const hit = (it) => (!onlyChanged || it.changed) && (!q || [it.label, it.help, it.effect, it.key, it.group, it.job && it.job.job_name, it.job && it.job.desc].join(' ').toLowerCase().includes(q));

  function jobSummary(xs) {
    const j = xs[0].job, sch = xs.find((x) => x.key.endsWith('.schedule')), ev = xs.find((x) => x.key.endsWith('.every')), mdl = xs.find((x) => x.key.endsWith('.model'));
    const freq = sch ? `${j.weekly ? '매주 ' : j.monthly ? '매월 ' : '매일 '}${sch.show}` : ev ? `${ev.show}마다` : '이벤트로 깨움';
    return [freq, mdl ? optName(mdl.value).split(' · ')[0] : '', j.next ? `다음 ${j.next}` : ''].filter(Boolean).join(' · ');
  }

  function jobCard(items) {
    const card = E('div', 'card'), h = E('div', 'card-h');
    h.append(E('h2', '', '예약 업무'), E('span', 'desc', `${new Set(items.map((x) => x.job.job)).size}개 업무 · 이름을 누르면 펼쳐져요`));
    card.append(h);
    if (D.group_help['예약 업무']) card.append(E('div', 'st-gdesc', D.group_help['예약 업무']));
    const byDom = new Map();
    for (const it of items) {
      const dm = it.job.domain || 'etc'; if (!byDom.has(dm)) byDom.set(dm, new Map());
      const m = byDom.get(dm); if (!m.has(it.job.job)) m.set(it.job.job, []); m.get(it.job.job).push(it);
    }
    for (const [dm, jobs] of byDom) {
      card.append(E('div', 'st-dom', DOMAIN[dm] || '기타'));
      for (const [jid, xs] of jobs) {
        const j = xs[0].job, box = E('details', 'st-job'), sm = E('summary');
        box.open = openJobs.has(jid) || !!q || onlyChanged;
        box.addEventListener('toggle', () => { if (box.open) openJobs.add(jid); else openJobs.delete(jid); });
        const nm = (window.noEmoji ? window.noEmoji(j.job_name) : j.job_name).trim();
        sm.append(E('b', '', /^[a-z0-9-]+$/.test(nm) ? `기타 업무 (${nm})` : nm), E('span', 'badge', j.job_kind === 'agent' ? 'AI 업무' : '스크립트'));
        const paused = D.paused.includes(jid);
        if (paused) sm.append(E('span', 'badge', '멈춤'));
        if (xs.some((x) => x.changed)) sm.append(E('span', 'badge', '바꿈'));
        sm.append(E('span', 'sum', jobSummary(xs)));
        box.append(sm);
        const rest = (j.desc || '').split(' — ').slice(1).join(' — ');
        if (rest || j.barund) {
          const jd = E('div', 'jd', rest);
          if (j.barund) {
            const b = E('button', 'btn sm ghost', paused ? '다시 켜기' : '멈춤'); b.type = 'button'; b.style.marginLeft = '8px';
            b.onclick = () => post({ op: paused ? 'resume' : 'pause', job: jid }, b); jd.append(b);
          }
          box.append(jd);
        }
        for (const it of xs) box.append(row(it));
        card.append(box);
      }
    }
    return card;
  }

  function body() {
    const out = $('st-body'); out.innerHTML = '';
    let n = 0;
    for (const g of D.groups) {
      if (grp && g !== grp) continue;
      const items = D.items.filter((it) => inGroup(it, g) && hit(it)).sort((a, b) => (b.key === ACCT_KEY) - (a.key === ACCT_KEY));   // 쿠팡 등록 계정은 '소싱·등록' 맨 위(+ '판매 수수료·계정'의 쿠팡 계정 카드)
      const acctHere = g === ACCT_GROUP && !onlyChanged && (!q || '쿠팡 계정 올리기 등록 판매자 출고지 반품지 wing'.includes(q) || D.accounts.some((a) => (a.label + a.name).toLowerCase().includes(q)));
      if (acctHere) { n += 1; }
      if (!items.length) { if (acctHere) out.append(acctCard()); continue; }
      n += items.length;
      if (g === '예약 업무') { out.append(jobCard(items)); continue; }
      const card = E('div', 'card'), h = E('div', 'card-h'), ch = items.filter((x) => x.changed).length;
      h.append(E('h2', '', g), E('span', 'desc', `${items.length}개${ch ? ` · 바꾼 것 ${ch}` : ''}`));
      card.append(h);
      if (D.group_help[g]) card.append(E('div', 'st-gdesc', D.group_help[g]));
      for (const it of items) card.append(row(it));
      out.append(card);
      if (acctHere) out.append(acctCard());
    }
    if (!n) out.append(Object.assign(E('div', 'card'), { textContent: onlyChanged ? '바꾼 설정이 없어요. 모두 기본값이에요' : '맞는 설정이 없어요. 다른 말로 찾아 보세요' }));
  }

  function chips() {
    const gs = $('st-groups'); gs.innerHTML = '';
    for (const g of ['', ...D.groups]) {
      const c = E('button', 'st-chip', g || '전체'); c.type = 'button'; c.setAttribute('aria-pressed', String(grp === g && !onlyChanged));
      const xs = D.items.filter((it) => !g || inGroup(it, g));   // 예약 업무는 칸 수가 아니라 업무 수
      c.append(E('span', 'n', String(g === '예약 업무' ? new Set(xs.map((x) => x.job && x.job.job)).size : xs.length)));
      c.onclick = () => { grp = g; onlyChanged = false; chips(); body(); }; gs.append(c);
    }
    const c = E('button', 'st-chip', '바꾼 것만'); c.type = 'button'; c.setAttribute('aria-pressed', String(onlyChanged));
    c.append(E('span', 'n', String(D.items.filter((x) => x.changed).length)));
    c.onclick = () => { onlyChanged = !onlyChanged; grp = ''; chips(); body(); }; gs.append(c);
  }


  // ── 쿠팡 계정 카드 ───────────────────────────────────────────────
  let addOpen = false, rekey = '';   // [계정 추가] 펼침 · 키를 바꾸는 중인 계정

  function acctCard() {
    const card = E('div', 'card'), h = E('div', 'card-h');
    const cur = D.accounts.find((a) => a.name === D.register_account) || D.accounts[0];
    h.append(E('h2', '', '쿠팡 계정'), E('span', 'desc', `지금: ${cur ? cur.label : '바른청년'}`));
    card.append(h, E('div', 'st-gdesc', '고른 계정에 새 쿠팡 상품·수량 옵션이 올라가요(소싱 자동 등록 포함 — 소싱·등록 묶음 맨 위와 같은 설정). 키를 넣은 계정은 그 계정 주문도 수집·발주확인·송장 올리기·취소·반품까지 바른청년과 똑같이 처리하고, 시트 플랫폼 칸에 "쿠팡·계정 이름"으로 보여요.'));
    const list = E('div', 'ac-list');
    for (const a of D.accounts) list.append(acctTile(a));
    card.append(list);
    if (addOpen) card.append(keyForm(''));
    else {
      const b = E('button', 'btn', '+ 쿠팡 계정 추가'); b.type = 'button'; b.style.marginTop = '12px';
      b.onclick = () => { addOpen = true; body(); setTimeout(() => { const f = document.getElementById('ak-label'); if (f && f.focus) f.focus(); }, 0); };
      card.append(b);
    }
    return card;
  }

  // 키 넣기 — 새 계정(name '') 또는 그 계정 키 바꾸기. 서버가 먼저 쿠팡을 읽어 보고 되면 저장(안 되면 아무것도 안 남음). 키는 다시 보여 주지 않음.
  function keyForm(name) {
    const box = E('div', 'ac ac-new'), msg = E('div', 'st-msg'), f = E('div', 'ac-f');
    box.append(E('b', '', name ? `${name} 키 바꾸기` : '쿠팡 계정 추가'));
    const ol = E('ol', 'ac-steps');
    const s1 = E('li'); s1.append('그 계정으로 ', Object.assign(E('a', '', 'Wing'), { href: 'https://wing.coupang.com', target: '_blank', rel: 'noopener' }), '에 로그인');
    ol.append(s1, E('li', '', '오른쪽 위 판매자명 → 판매자정보 → 추가판매정보 → OPEN API 키 발급'),
      E('li', '', '업체코드·Access Key·Secret Key를 복사해 아래에 붙여 넣기(허용 IP를 물으면 바른청년 키에 등록한 IP와 같게)'));
    box.append(ol);
    const inp = (id, label, ph, type, hint) => {
      const i = E('input'); i.id = id; i.placeholder = ph; i.type = type || 'text'; i.autocomplete = 'off'; i.spellcheck = false; i.setAttribute('aria-label', label);
      const l = E('label', '', label); l.htmlFor = id;
      let field = i;
      if (type === 'password') {                      // 칸 옆 [보기] — 붙여 넣은 키를 눈으로 확인
        field = E('div', 'ac-key'); const eye = E('button', 'btn sm ghost', '보기'); eye.type = 'button'; eye.setAttribute('aria-label', `${label} 보기`);
        eye.onclick = () => { i.type = i.type === 'password' ? 'text' : 'password'; eye.textContent = i.type === 'password' ? '보기' : '가리기'; };
        field.append(i, eye);
      }
      f.append(l, field); if (hint) f.append(E('div', 'hint', hint)); return i;
    };
    const label = name ? null : inp('ak-label', '보이는 이름', '예: 푸드투 상사', 'text', '목록에 보일 이름(아무거나)');
    const vendor = inp('ak-vendor', '업체코드', 'A00123456', 'text', '영문 1자 + 숫자');
    const access = inp('ak-access', 'Access Key', '붙여 넣기', 'password', '저장한 뒤엔 끝 4자리만 보여요');
    const secret = inp('ak-secret', 'Secret Key', '붙여 넣기', 'password', '이 맥미니 비밀 폴더에만 저장돼요. 화면과 기록에는 다시 나오지 않아요');
    const row = E('div', 'st-bar'); row.style.marginTop = '12px';
    const go = E('button', 'btn primary', name ? '연결 확인하고 키 바꾸기' : '연결 확인하고 저장'); go.type = 'button';
    const cancel = E('button', 'btn ghost', '취소'); cancel.type = 'button';
    cancel.onclick = () => { addOpen = false; rekey = ''; body(); };
    go.onclick = async () => {
      const t = go.textContent; go.textContent = '쿠팡에 연결해 보는 중…'; msg.className = 'st-msg'; msg.textContent = '';
      const fields = { name, label: label ? label.value : '', vendor_id: vendor.value, access_key: access.value, secret_key: secret.value, replace: !!name };
      const r = await post({ op: 'acct_add', fields }, go, msg);
      go.textContent = t;
      if (r && r.ok) {
        const nm = name || String(vendor.value).trim().toLowerCase();
        acctMsg.set(nm, { text: r.msg, ok: true }); openAcct.add(nm);    // 이어서 Wing 아이디·번호를 바로 넣게 펼침
        access.value = secret.value = ''; addOpen = false; rekey = '';
      }
    };
    row.append(go, cancel);
    box.append(f, row, msg);
    return box;
  }

  function acctTile(a) {
    const on = a.name === D.register_account, ready = !a.problems.length;
    const box = E('div', 'ac' + (on ? ' on' : '')), h = E('div', 'ac-h'), msg = E('div', 'st-msg');
    const last = acctMsg.get(a.name); if (last) { msg.textContent = last.text; msg.className = 'st-msg' + (last.ok ? '' : ' bad'); }
    const keep = (r) => { if (r) acctMsg.set(a.name, { text: r.msg || '', ok: !!r.ok }); };
    h.append(E('b', '', a.label || a.name));
    if (a.name && a.label && a.label !== a.name) h.append(E('span', 'muted small', a.name));
    if (a.main) h.append(E('span', 'badge', '운영 계정'));
    if (on) h.append(E('span', 'badge', '새 상품은 여기로'));
    h.append(E('span', ready ? 'ac-ok' : 'ac-no', ready ? '올릴 수 있어요' : `준비 덜 됨 ${a.problems.length}`));
    const sp = E('span', 'sp');
    if (!on) {
      const go = E('button', 'btn sm', '여기에 올리기'); go.type = 'button'; go.disabled = !ready;
      if (!ready) go.title = '아래 채울 것을 먼저 채워 주세요';
      let armed = 0;
      go.onclick = () => {
        if (Date.now() - armed > 4000) {
          armed = Date.now(); msg.className = 'st-msg bad'; msg.textContent = `새 쿠팡 상품을 '${a.label || a.name}'에 올리게 바꿔요. 맞으면 4초 안에 한 번 더 눌러 주세요`;
          go.textContent = '한 번 더 눌러 확정'; setTimeout(() => { go.textContent = '여기에 올리기'; }, 4000); return;
        }
        post({ op: 'set', key: ACCT_KEY, value: a.name }, go, msg).then(keep);
      };
      sp.append(go);
    }
    const ck = E('button', 'btn sm ghost', '연결 확인'); ck.type = 'button'; ck.title = '그 계정 키로 쿠팡을 읽기만 해요(판매자 번호·출고지·반품지)';
    ck.onclick = () => { msg.className = 'st-msg'; msg.textContent = '쿠팡에 묻는 중…'; post({ op: 'acct_check', name: a.name }, ck, msg).then(keep); };
    sp.append(ck);
    if (!a.main) {
      const ed = E('button', 'btn sm ghost', openAcct.has(a.name) ? '접기' : '정보 고치기'); ed.type = 'button';
      ed.onclick = () => { if (openAcct.has(a.name)) openAcct.delete(a.name); else openAcct.add(a.name); body(); };
      sp.append(ed);
    }
    h.append(sp); box.append(h);
    const ch = a.checked || {};
    const places = Object.entries(a.places || {}).map(([c, code]) => `${COUNTRY[c] || c} ${code}`).join(' · ');
    const rc = (ch.return_centers || []).find((x) => x.code === a.return_center);
    const info = a.main
      ? ['본보기 상품의 출고지·반품지·연락처를 그대로 써요', ch.vendor_id ? `판매자 ${ch.vendor_id}` : '', ch.at ? `연결 확인 ${when(ch.at)}${ch.ok ? '' : ' 실패'}` : '']
      : [ch.vendor_id ? `판매자 ${ch.vendor_id}` : '판매자 번호는 연결 확인 뒤에 보여요', a.vendor_user_id ? `Wing ${a.vendor_user_id}` : '', places ? `출고지 ${places}` : '',
        rc ? `반품지 ${rc.name}` : '', a.contact ? `고객센터 ${a.contact}` : '', a.detail_image ? '공통 상세 사진 있음' : '공통 상세 사진 없음(설계 상세를 씀)',
        ch.at ? `연결 확인 ${when(ch.at)}${ch.ok ? '' : ' 실패'}` : ''];
    const meta = E('div', 'ac-m'); info.filter(Boolean).forEach((x, i) => { if (i) meta.append(' · '); const sp = E('span', '', x); if (x.length <= 22) sp.style.whiteSpace = 'nowrap'; meta.append(sp); });   // 번호·코드가 줄 끝에서 안 쪼개지게
    box.append(meta);
    if (a.problems.length) { const ul = E('ul', 'ac-todo'); for (const p of a.problems) ul.append(E('li', '', p)); box.append(ul); }
    if (!a.main && openAcct.has(a.name)) box.append(acctForm(a, msg, keep));
    box.append(msg);
    return box;
  }

  function acctForm(a, msg, keep) {
    const ch = a.checked || {}, f = E('div', 'ac-f'), val = {};
    const lab = (label, el) => { const id = `ac-${a.name}-${Object.keys(val).length}`; el.id = id; el.setAttribute('aria-label', label); const l = E('label', '', label); l.htmlFor = id; f.append(l, el); };
    const text = (key, label, ph, hint) => {
      const i = E('input'); i.value = a[key] || ''; i.placeholder = ph || ''; i.title = ph || ''; lab(label, i); val[key] = () => i.value;
      if (hint) f.append(E('div', 'hint', hint));
    };
    text('label', '보이는 이름', '예: 푸드투 상사');
    text('vendor_user_id', 'Wing 로그인 아이디', '그 계정 Wing에 로그인하는 아이디', '쿠팡 상품 등록에 꼭 들어가요(vendorUserId)');
    text('contact', '고객센터 번호', '02-1234-5678', '상품의 판매자 연락처·A/S 번호로 들어가요');
    text('as_info', 'A/S 안내', '비우면 "해외구매대행 상품입니다. 문의는 고객센터 …"');
    text('detail_image', '공통 상세 사진 주소', 'https://…', '다른 사업자 계정 상세는 공통 안내 사진 한 장(비우면 설계 상세를 쓰고 바른청년 안내 띠만 뺌)');
    const rs = E('select'); rs.append(new Option('(고르기)', ''));
    for (const x of (ch.return_centers || []).filter((x) => x.usable)) rs.append(new Option(`${x.name} · ${x.addr} ${x.detail}`.trim(), x.code));
    rs.value = a.return_center || ''; lab('반품지', rs); val.return_center = () => rs.value;
    if (!(ch.return_centers || []).length) f.append(E('div', 'hint', '[연결 확인]을 먼저 누르면 그 계정 반품지가 나와요'));
    const usable = (ch.places || []).filter((x) => x.usable);
    const countries = [...new Set(usable.filter((x) => x.country && x.country !== 'KR').map((x) => x.country))];
    const pl = E('div', 'ac-places'), sel = {};
    for (const c of countries) {
      const s = E('select'); s.append(new Option('(안 씀)', ''));
      for (const x of usable.filter((x) => x.country === c)) s.append(new Option(`${x.name} ${x.code}`, x.code));
      s.value = (a.places || {})[c] || ''; s.setAttribute('aria-label', `${COUNTRY[c] || c} 출고지`); sel[c] = s;
      const d = E('div'); d.append(E('span', '', COUNTRY[c] || c), s); pl.append(d);
    }
    val.places = () => Object.fromEntries(Object.entries(sel).map(([c, s]) => [c, s.value]).filter(([, v]) => v));
    f.append(E('label', '', '나라별 출고지'), countries.length ? pl : E('div', 'muted small', '[연결 확인]을 먼저 누르면 그 계정 출고지가 나라별로 나와요'));
    const b = E('button', 'btn sm', '계정 정보 저장'); b.type = 'button';
    b.onclick = () => post({ op: 'acct_save', name: a.name, fields: Object.fromEntries(Object.entries(val).map(([k, fn]) => [k, fn()])) }, b, msg).then(keep);
    f.append(E('span'), b);
    const kr = E('div', 'st-bar');                   // 키 — 끝 4자리만, 바꾸기·빼기
    kr.append(E('span', 'muted small', `Access Key ${a.key_hint || ''} · 업체코드 ${(a.checked || {}).vendor_id || '연결 확인 전'}`));
    const rk = E('button', 'btn sm ghost', '키 바꾸기'); rk.type = 'button';
    rk.onclick = () => { rekey = a.name; body(); };
    const rm = E('button', 'btn sm ghost', '계정 빼기'); rm.type = 'button';
    let armed = 0;
    rm.onclick = () => {
      if (Date.now() - armed > 4000) { armed = Date.now(); rm.textContent = '한 번 더 눌러 빼기'; msg.className = 'st-msg bad'; msg.textContent = '이 계정을 목록에서 빼요. 키 파일은 보관 폴더로 옮겨 둬서 다시 넣을 수 있어요. 맞으면 4초 안에 한 번 더 눌러 주세요'; setTimeout(() => { rm.textContent = '계정 빼기'; }, 4000); return; }
      openAcct.delete(a.name); post({ op: 'acct_remove', name: a.name }, rm, msg).then(keep);
    };
    kr.append(rk, rm);
    f.append(E('label', '', '키'), kr);
    if (rekey === a.name) { const kf = keyForm(a.name); kf.style.gridColumn = '1 / -1'; f.append(kf); }
    return f;
  }

  function render(d) {
    D = { group_help: {}, links: [], paused: [], history: [], accounts: [], register_account: '', ...d };
    const changed = D.items.filter((x) => x.changed), total = D.items.filter((x) => x.key !== ACCT_KEY).length;
    $('st-title').textContent = changed.length ? `설정 ${total}개 중 ${changed.length}개를 바꿨어요` : `설정 ${total}개 · 모두 기본값이에요`;
    const st = $('st-stats'); st.innerHTML = '';
    st.append(stat('설정', String(total), `${D.groups.length}묶음`), stat('바꾼 것', String(changed.length), '기본값과 다름'),
      stat('바깥에 쓰는 스위치', String(D.items.filter((x) => x.risk).length), '두 번 눌러 저장'),
      stat('최근 바꿈', D.history[0] ? when(D.history[0].at) : '없음', D.history[0] ? D.history[0].label : ''));
    chips();
    $('st-links-card').hidden = !D.links.length;
    const ls = $('st-links'); ls.innerHTML = '';
    for (const l of D.links) {
      const b = E('button', 'st-link'); b.type = 'button'; b.append(E('b', '', l.label), E('span', '', l.desc || ''));
      b.onclick = () => { if (typeof window.showTab === 'function') window.showTab(l.page); else location.hash = '#' + l.page; };
      ls.append(b);
    }
    body();
    const ht = $('st-hist'); ht.innerHTML = '';
    if (!D.history.length) { ht.append(E('div', 'muted small', '아직 바꾼 설정이 없어요')); return; }
    const tb = E('table', 'st-tbl'); tb.innerHTML = '<tr><th>때</th><th>설정</th><th>전</th><th>후</th><th>누가</th></tr>';
    for (const x of D.history) {
      const tr = E('tr');
      tr.append(E('td', 't', when(x.at)), E('td', '', x.label), E('td', 'v', x.old), E('td', 'v', x.new), E('td', '', x.by));
      tb.append(tr);
    }
    ht.append(tb);
  }

  async function load() {
    if (busy) return; busy = true;
    try { const r = await (window.barunFetch || fetch)('/api/settings'); if (r.ok) render(await r.json()); }
    catch (e) { /* 토큰 창은 barunFetch가 띄움 */ } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
