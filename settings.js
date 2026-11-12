// 설정 화면 — 코드를 고치지 않고 바꾸는 값 한 곳(2026-11-12 사장님: "지금 사용하는 모든 하드코딩된 값을 … 설정 페이지에서 편하게 바꿀 수 있게",
// 같은 날 "도움말도 대거 잘 추가하고 UIUX 잘 다듬고"). 읽기: GET /api/settings(barun/views/settings.snapshot) ·
// 바꾸기: POST /api/action {action:'settings', op:'set'|'reset'|'pause'|'resume', key, value}.
// 목록 원본은 config/settings.toml(설명 help · 바꾸면 effect · 바깥에 쓰는 스위치 risk · 묶음 설명 group_help) + 예약 업무(jobs/jobs.toml).
// 화면은 칸 종류(kind)만 보고 그린다. 비밀번호·카드번호는 받지 않는다. 바깥에 쓰는 스위치(risk)는 두 번 눌러야 저장.
// 자리: index.html에 미리 있는 화면(#p-settings)을 채운다(보임·숨김은 'barun:page' 이벤트).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const NUM = ['int', 'money', 'pct', 'float', 'minutes'];
  const DOMAIN = { orders: '주문·발송·배대지', mail: '메일·송장', pricing: '가격·위너·판매', inquiry: '고객문의', close: '마감', improve: '자가개선',
    infra: '인프라·감시', sourcing: '소싱·등록' };
  const when = (at) => String(at || '').slice(5, 16).replace('T', ' ');
  let D = null, busy = false, q = '', grp = '', onlyChanged = false;
  const openJobs = new Set();

  function install() {
    const sec = $('p-settings'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      #p-settings { display: grid; gap: 14px; }
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
      .st-eff { font-size: 12.5px; color: var(--sub); margin-top: 3px; line-height: 1.5; } .st-eff::before { content: '바꾸면 · '; color: var(--muted); }
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
      .st-job > summary::before { content: '▸'; color: var(--muted); position: absolute; left: 4px; top: 11px; } .st-job[open] > summary::before { content: '▾'; }
      .st-job b { font-size: 14px; } .st-job .sum { font-size: 12.5px; color: var(--sub); margin-left: auto; font-variant-numeric: tabular-nums; }
      .st-job .jd { font-size: 12.5px; color: var(--sub); line-height: 1.5; padding: 0 2px 6px 22px; }
      .st-job .st-row { padding-left: 22px; border-top: 0; }
      .st-tbl { width: 100%; border-collapse: collapse; font-size: 13px; } .st-tbl td, .st-tbl th { padding: 7px 6px; border-top: 1px solid var(--line); text-align: left; vertical-align: top; }
      .st-tbl th { color: var(--muted); font-weight: 600; } .st-tbl td.v, .st-tbl td.t { white-space: nowrap; }
      .st-links { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); align-items: stretch; }
      .st-link { display: flex; flex-direction: column; justify-content: flex-start; gap: 3px; text-align: left; font: inherit; padding: 10px 12px; border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--fill2); color: var(--ink); cursor: pointer; }
      .st-link span { font-size: 12.5px; color: var(--sub); }
      @media (max-width: 720px) { .st-row { grid-template-columns: 1fr; gap: 8px; } .st-v { justify-content: flex-start; } .st-msg { text-align: left; } .st-job .sum { margin-left: 22px; flex-basis: 100%; } }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero"><h2 id="st-title">불러오는 중</h2><p class="lead">코드를 고치지 않고 바꾸는 값이에요. 저장하면 늦어도 10초 뒤 모든 업무가 새 값을 써요.</p>
        <div class="stats" id="st-stats"></div>
        <details class="st-guide" id="st-guide"><summary>어떻게 쓰나요</summary><ul>
          <li><b>바꾸기</b> — 칸을 고치면 <b>저장</b>이 켜져요. 엔터로도 저장, Esc는 되돌리기. 결과는 그 줄 아래에 바로 나와요.</li>
          <li><b>기본값</b> — 칸마다 원래 값이 적혀 있고, 바꾼 칸에는 <b>기본값으로</b> 버튼이 생겨요. 아래 '바꾼 기록'에 누가 언제 무엇을 바꿨는지 남아요.</li>
          <li><b>바깥에 써요</b> 표시 — 결제·등록·고객 답변·자동 승인처럼 바깥에 실제로 쓰는 스위치예요. 실수하지 않게 저장을 두 번 눌러야 해요.</li>
          <li><b>예약 업무</b> — 업무 이름을 누르면 시각·주기·모델이 펼쳐져요. 시각을 바꾸면 그 업무 예약만 다시 걸고, 돌고 있으면 끝난 뒤에 걸어요. 잠깐 쉬게 하려면 시각을 지우지 말고 <b>멈춤</b>.</li>
          <li><b>지침의 숫자</b>(48시간·5일·하루 10줄 등)는 기본값이에요 — 에이전트는 판단 전에 여기 지금 값을 봐요(바꾸지는 못해요).</li>
          <li>비밀번호·카드번호·API 키는 넣지 않아요 — 넣으면 거부돼요. 카드는 결제 화면에 끝 4자리만, 로그인은 사장님이 직접.</li>
        </ul></details></div>
      <div class="card"><div class="st-bar"><input id="st-q" type="search" placeholder="설정 찾기 — 한도, 위너, 소싱, 시각, 모델…" aria-label="설정 찾기"></div>
        <div class="st-bar" id="st-groups" style="margin-top:10px"></div></div>
      <div class="card" id="st-links-card" hidden><div class="card-h"><h2>다른 화면에서 바꾸는 설정</h2><span class="desc">원본이 그 화면에 있어요</span></div><div class="st-links" id="st-links"></div></div>
      <div id="st-body" style="display:grid;gap:14px"></div>
      <div class="card"><div class="card-h"><h2>바꾼 기록</h2><span class="desc">누가 언제 무엇을 — 최근 50개</span></div><div id="st-hist"></div></div>`;
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
    } catch (e) { if (msg) { msg.textContent = '저장하지 못했어요 — 연결을 확인해 주세요'; msg.className = 'st-msg bad'; } return null; }
    finally { if (el) el.disabled = false; }
  }

  const shown = (it, v) => Array.isArray(v) ? v.join(it.kind === 'list' ? '\n' : ', ') : it.kind === 'money' ? Number(v || 0).toLocaleString('ko-KR') : String(v ?? '');

  function input(it, row) {
    const box = E('div', 'st-v'), msg = E('div', 'st-msg');
    let armed = 0;
    const save = (v, el) => {
      if (it.risk && Date.now() - armed > 4000) {          // 바깥에 쓰는 스위치 — 4초 안에 한 번 더
        armed = Date.now(); msg.className = 'st-msg bad'; msg.textContent = '바깥에 실제로 쓰는 설정이에요 — 맞으면 4초 안에 한 번 더 눌러 주세요'; return null;
      }
      armed = 0; return post({ op: 'set', key: it.key, value: v }, el, msg);
    };
    if (it.kind === 'bool' || it.kind === 'choice') {
      const s = E('select');
      if (it.kind === 'bool') s.append(new Option('켬', '1'), new Option('끔', '0'));
      else for (const c of it.choices) s.append(new Option(String(c) || '바른청년(기본)', c));
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
    if (it.risk) h.append(E('span', 'st-risk', '바깥에 써요'));
    l.append(h);
    if (it.help) l.append(E('div', 'st-help', it.help));
    if (it.effect) l.append(E('div', 'st-eff', it.effect));
    l.append(E('div', 'st-def', [`기본값 ${it.show_default}`, it.changed && it.by ? `${it.by} · ${when(it.at)} 바꿈` : '', it.used ? `쓰는 곳 ${it.used}` : ''].filter(Boolean).join(' · ')));
    d.append(l, input(it, d));
    return d;
  }

  const hit = (it) => (!onlyChanged || it.changed) && (!q || [it.label, it.help, it.effect, it.key, it.group, it.job && it.job.job_name, it.job && it.job.desc].join(' ').toLowerCase().includes(q));

  function jobSummary(xs) {
    const j = xs[0].job, sch = xs.find((x) => x.key.endsWith('.schedule')), ev = xs.find((x) => x.key.endsWith('.every')), mdl = xs.find((x) => x.key.endsWith('.model'));
    const freq = sch ? `${j.weekly ? '매주 ' : j.monthly ? '매월 ' : '매일 '}${sch.show}` : ev ? `${ev.show}마다` : '이벤트로 깨움';
    return [freq, mdl ? String(mdl.show).replace('claude-', '') : '', j.next ? `다음 ${j.next}` : ''].filter(Boolean).join(' · ');
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
        sm.append(E('b', '', j.job_name), E('span', 'badge', j.job_kind === 'agent' ? 'AI 업무' : '스크립트'));
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
      const items = D.items.filter((it) => it.group === g && hit(it));
      if (!items.length) continue;
      n += items.length;
      if (g === '예약 업무') { out.append(jobCard(items)); continue; }
      const card = E('div', 'card'), h = E('div', 'card-h'), ch = items.filter((x) => x.changed).length;
      h.append(E('h2', '', g), E('span', 'desc', `${items.length}개${ch ? ` · 바꾼 것 ${ch}` : ''}`));
      card.append(h);
      if (D.group_help[g]) card.append(E('div', 'st-gdesc', D.group_help[g]));
      for (const it of items) card.append(row(it));
      out.append(card);
    }
    if (!n) out.append(Object.assign(E('div', 'card'), { textContent: onlyChanged ? '바꾼 설정이 없어요 — 모두 기본값이에요' : '맞는 설정이 없어요 — 다른 말로 찾아 보세요' }));
  }

  function chips() {
    const gs = $('st-groups'); gs.innerHTML = '';
    for (const g of ['', ...D.groups]) {
      const c = E('button', 'st-chip', g || '전체'); c.type = 'button'; c.setAttribute('aria-pressed', String(grp === g && !onlyChanged));
      const xs = D.items.filter((it) => !g || it.group === g);   // 예약 업무는 칸 수가 아니라 업무 수
      c.append(E('span', 'n', String(g === '예약 업무' ? new Set(xs.map((x) => x.job && x.job.job)).size : xs.length)));
      c.onclick = () => { grp = g; onlyChanged = false; chips(); body(); }; gs.append(c);
    }
    const c = E('button', 'st-chip', '바꾼 것만'); c.type = 'button'; c.setAttribute('aria-pressed', String(onlyChanged));
    c.append(E('span', 'n', String(D.items.filter((x) => x.changed).length)));
    c.onclick = () => { onlyChanged = !onlyChanged; grp = ''; chips(); body(); }; gs.append(c);
  }

  function render(d) {
    D = { group_help: {}, links: [], paused: [], history: [], ...d };
    const changed = D.items.filter((x) => x.changed);
    $('st-title').textContent = changed.length ? `설정 ${D.items.length}개 · 바꾼 것 ${changed.length}개` : `설정 ${D.items.length}개 · 모두 기본값`;
    const st = $('st-stats'); st.innerHTML = '';
    st.append(stat('설정', String(D.items.length), `${D.groups.length}묶음`), stat('바꾼 것', String(changed.length), '기본값과 다름'),
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
