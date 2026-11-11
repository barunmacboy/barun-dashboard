// 설정 화면 — 코드를 고치지 않고 바꾸는 값 한 곳(2026-11-12 사장님: "지금 사용하는 모든 하드코딩된 값을 … 설정 페이지에서 편하게 바꿀 수 있게").
// 읽기: GET /api/settings(barun/settings.snapshot) · 바꾸기: POST /api/action {action:'settings', op:'set'|'reset'|'pause'|'resume', key, value}.
// 목록 원본은 config/settings.toml + 예약 업무(jobs/jobs.toml) — 화면은 칸 종류(kind)만 보고 그린다. 비밀번호·카드번호는 받지 않는다.
// 자리: index.html에 미리 있는 화면(#p-settings)을 채운다(보임·숨김은 'barun:page' 이벤트).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const NUM = ['int', 'money', 'pct', 'float', 'minutes'];
  let D = null, busy = false, q = '', grp = '';

  function install() {
    const sec = $('p-settings'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      #p-settings { display: grid; gap: 14px; }
      .st-bar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .st-bar input { font: inherit; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--ink); flex: 1 1 220px; min-width: 0; }
      .st-chip { font: inherit; font-size: 13px; padding: 5px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--card); color: var(--sub); cursor: pointer; }
      .st-chip[aria-pressed="true"] { background: var(--ink); color: var(--card); border-color: var(--ink); }
      .st-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 300px); gap: 12px; padding: 12px 2px; border-top: 1px solid var(--line); align-items: start; }
      .st-row:first-child { border-top: 0; }
      .st-l b { font-size: 14px; } .st-help { font-size: 12.5px; color: var(--sub); margin-top: 3px; line-height: 1.45; }
      .st-def { font-size: 12px; color: var(--muted); margin-top: 3px; }
      .st-v { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; justify-content: flex-end; }
      .st-v input, .st-v select, .st-v textarea { font: inherit; font-size: 13.5px; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--ink); min-width: 0; }
      .st-v input.n { width: 120px; text-align: right; font-variant-numeric: tabular-nums; } .st-v input.t { flex: 1 1 200px; }
      .st-v textarea { flex: 1 1 100%; min-height: 64px; resize: vertical; }
      .st-u { font-size: 13px; color: var(--sub); }
      .st-job { padding: 12px 2px 4px; border-top: 1px solid var(--line); } .st-job:first-child { border-top: 0; }
      .st-job-h { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .st-job-h b { font-size: 14.5px; }
      .st-job .st-row { border-top: 0; padding: 6px 0 6px 12px; }
      .st-tbl { width: 100%; border-collapse: collapse; font-size: 13px; } .st-tbl td, .st-tbl th { padding: 7px 6px; border-top: 1px solid var(--line); text-align: left; vertical-align: top; }
      .st-tbl th { color: var(--muted); font-weight: 600; }
      .st-links { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
      .st-link { display: flex; flex-direction: column; justify-content: flex-start; text-align: left; font: inherit; padding: 10px 12px; border-radius: var(--r-sm); border: 1px solid var(--line); background: var(--fill2); color: var(--ink); cursor: pointer; }
      .st-link span { display: block; font-size: 12.5px; color: var(--sub); margin-top: 2px; }
      @media (max-width: 720px) { .st-row { grid-template-columns: 1fr; } .st-v { justify-content: flex-start; } }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero"><h2 id="st-title">불러오는 중</h2><p class="lead">코드를 고치지 않고 바꾸는 값이에요. 저장하면 늦어도 10초 뒤 모든 업무가 새 값을 써요.
        비밀번호·카드번호·API 키는 여기에 넣지 않아요(로그인은 직접, 카드는 끝 4자리만).</p><div class="stats" id="st-stats"></div></div>
      <div class="card"><div class="st-bar"><input id="st-q" type="search" placeholder="설정 찾기(예: 한도, 위너, 소싱, 시각)" aria-label="설정 찾기"></div>
        <div class="st-bar" id="st-groups" style="margin-top:10px"></div></div>
      <div class="card" id="st-links-card" hidden><div class="card-h"><h2>다른 화면에서 바꾸는 설정</h2><span class="desc">원본이 그 화면에 있어요</span></div><div class="st-links" id="st-links"></div></div>
      <div id="st-body" style="display:grid;gap:14px"></div>
      <div class="card"><div class="card-h"><h2>바꾼 기록</h2><span class="desc">누가 언제 무엇을</span></div><div id="st-hist"></div></div>`;
    $('st-q').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); body(); });
    document.addEventListener('barun:page', (e) => { if (e.detail === 'settings') load(); });
    if (!sec.hidden) load();
    return true;
  }

  const stat = (k, v, d) => { const s = E('div', 'stat'); s.style.cursor = 'default'; s.append(E('div', 'k', k), E('div', 'v', v), E('div', 'd', d || '')); return s; };

  async function post(body, el) {
    if (el) el.disabled = true;
    try {
      const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'settings', ...body }) });
      const j = await r.json(); if (window.toast) window.toast(j.msg); if (j.ok) load(); return j;
    } catch (e) { return null; } finally { if (el) el.disabled = false; }
  }

  function input(it) {
    const box = E('div', 'st-v');
    const save = (v, el) => post({ op: 'set', key: it.key, value: v }, el);
    if (it.kind === 'bool') {
      const s = E('select'); s.append(new Option('켬', '1'), new Option('끔', '0')); s.value = it.value ? '1' : '0';
      s.onchange = () => save(s.value === '1', s); box.append(s);
    } else if (it.kind === 'choice') {
      const s = E('select'); for (const c of it.choices) s.append(new Option(String(c) || '바른청년(기본)', c)); s.value = it.value;
      s.onchange = () => save(s.value, s); box.append(s);
    } else {
      const multi = it.kind === 'list';
      const f = E(multi ? 'textarea' : 'input', NUM.includes(it.kind) ? 'n' : 't');
      f.value = Array.isArray(it.value) ? it.value.join(multi ? '\n' : ', ') : it.kind === 'money' ? Number(it.value || 0).toLocaleString('ko-KR') : (it.value ?? '');
      if (NUM.includes(it.kind)) f.inputMode = 'decimal';
      if (multi) f.placeholder = '한 줄에 하나'; else if (it.kind === 'times') f.placeholder = '09:30, 14:00';
      f.setAttribute('aria-label', it.label);
      const b = E('button', 'btn sm', '저장'); b.type = 'button'; b.onclick = () => save(f.value, b);
      if (!multi) f.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(f.value, b); });
      const unit = it.unit || (it.kind === 'money' ? '원' : '');
      box.append(f); if (unit) box.append(E('span', 'st-u', unit)); box.append(b);
    }
    if (it.changed) { const r = E('button', 'btn sm ghost', '기본값으로'); r.type = 'button'; r.onclick = () => post({ op: 'reset', key: it.key }, r); box.append(r); }
    return box;
  }

  function row(it) {
    const d = E('div', 'st-row'); d.dataset.key = it.key;
    const l = E('div', 'st-l'); const h = E('div'); h.append(E('b', '', it.label));
    if (it.changed) h.append(' ', E('span', 'badge', '바꿈'));
    l.append(h);
    if (it.help) l.append(E('div', 'st-help', it.help));
    l.append(E('div', 'st-def', [`기본값 ${it.show_default}`, it.changed && it.by ? `${it.by} · ${String(it.at).slice(5, 16).replace('T', ' ')}` : '', it.used ? `쓰는 곳 ${it.used}` : ''].filter(Boolean).join(' · ')));
    d.append(l, input(it));
    return d;
  }

  const hit = (it) => !q || [it.label, it.help, it.key, it.group, it.job && it.job.job_name].join(' ').toLowerCase().includes(q);

  function jobCard(items) {
    const card = E('div', 'card'); card.append(Object.assign(E('div', 'card-h'), { innerHTML: '' }));
    card.firstChild.append(E('h2', '', '예약 업무'), E('span', 'desc', '언제·얼마나 자주 도는지, AI 업무의 모델·시간·비용 상한'));
    const by = new Map();
    for (const it of items) { const k = it.job.job; if (!by.has(k)) by.set(k, []); by.get(k).push(it); }
    for (const [jid, xs] of by) {
      const j = xs[0].job, box = E('div', 'st-job'), h = E('div', 'st-job-h');
      h.append(E('b', '', j.job_name), E('span', 'badge', j.job_kind === 'agent' ? 'AI 업무' : '스크립트'));
      const paused = D.paused.includes(jid);
      if (paused) h.append(E('span', 'badge', '멈춤'));
      if (j.barund) {
        const b = E('button', 'btn sm ghost', paused ? '다시 켜기' : '멈춤'); b.type = 'button';
        b.onclick = () => post({ op: paused ? 'resume' : 'pause', job: jid }, b); h.append(b);
      }
      box.append(h); for (const it of xs) box.append(row(it));
      card.append(box);
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
      const card = E('div', 'card'), h = E('div', 'card-h'); h.append(E('h2', '', g), E('span', 'desc', `${items.length}개`));
      card.append(h); for (const it of items) card.append(row(it));
      out.append(card);
    }
    if (!n) out.append(Object.assign(E('div', 'card'), { textContent: '맞는 설정이 없어요' }));
  }

  function render(d) {
    D = d;
    const changed = d.items.filter((x) => x.changed);
    $('st-title').textContent = changed.length ? `설정 ${d.items.length}개 · 바꾼 것 ${changed.length}개` : `설정 ${d.items.length}개 · 모두 기본값`;
    const st = $('st-stats'); st.innerHTML = '';
    st.append(stat('설정', String(d.items.length), `${d.groups.length}묶음`), stat('바꾼 것', String(changed.length), '기본값과 다름'),
      stat('최근 바꿈', d.history[0] ? String(d.history[0].at).slice(5, 16).replace('T', ' ') : '없음', d.history[0] ? d.history[0].label : ''));
    const gs = $('st-groups'); gs.innerHTML = '';
    for (const g of ['', ...d.groups]) {
      const c = E('button', 'st-chip', g || '전체'); c.type = 'button'; c.setAttribute('aria-pressed', String(grp === g));
      c.onclick = () => { grp = g; render(D); }; gs.append(c);
    }
    $('st-links-card').hidden = !d.links.length;
    const ls = $('st-links'); ls.innerHTML = '';
    for (const l of d.links) {
      const b = E('button', 'st-link', l.label); b.type = 'button'; b.append(E('span', '', l.desc || ''));
      b.onclick = () => { if (typeof window.showTab === 'function') window.showTab(l.page); else location.hash = '#' + l.page; };
      ls.append(b);
    }
    body();
    const ht = $('st-hist'); ht.innerHTML = '';
    if (!d.history.length) { ht.append(E('div', 'muted small', '아직 바꾼 설정이 없어요')); return; }
    const tb = E('table', 'st-tbl'); tb.innerHTML = '<tr><th>때</th><th>설정</th><th>전</th><th>후</th><th>누가</th></tr>';
    for (const x of d.history) {
      const tr = E('tr');
      tr.append(E('td', '', String(x.at).slice(5, 16).replace('T', ' ')), E('td', '', x.label), E('td', '', x.old), E('td', '', x.new), E('td', '', x.by));
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
