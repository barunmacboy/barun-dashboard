// 보낸 문의 화면 — 배대지·구매처·쿠팡에 넣은 1:1 문의가 어디까지 왔나(2026-10-22 사장님: "여기저기 1:1 문의를 많이 넣는데 트래킹하는 화면").
// 순서 = 할 일 순: 답 옴(확인 필요) → 기다림(오래된 것 먼저, 2일 주황·4일 빨강) → 최근 끝. 읽기: GET /api/asks(ops/asks.py), 상태 바꾸기: POST /api/action {action:'ask'}.
// 자리: index.html에 미리 있는 화면(#p-…)을 채운다(보임·숨김은 'barun:page' 이벤트).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const LVL = { new: ['답 옴', 'run'], bad: ['4일+', 'bad'], warn: ['2일+', 'warn'], wait: ['기다림', ''], ok: ['끝', 'ok'] };
  const noE = (t) => (window.noEmoji ? window.noEmoji(t) : String(t ?? ''));
  const ic = (name) => { const e = E('span', 'ak-i'); e.innerHTML = window.ico ? window.ico(name) : ''; return e; };
  let timer = 0, busy = false;

  function install() {
    const sec = $('p-asks'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      .ak-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 2px; border-top: 1px solid var(--line); }
      .ak-row:first-child { border-top: 0; }
      .ak-site { flex: 0 0 auto; min-width: 74px; font-size: 12px; font-weight: 600; color: var(--sub); padding-top: 2px; word-break: keep-all; }
      .ak-body { flex: 1; min-width: 0; } .ak-t { font-weight: 600; line-height: 1.4; }
      .ak-m { font-size: 13px; color: var(--sub); margin-top: 3px; } .ak-a { font-size: 13px; margin-top: 6px; padding: 8px 10px; background: var(--fill2); border-radius: var(--r-sm); }
      .ak-side { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
      .ak-age { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--muted); }
      .ak-btns { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
      .ak-i { display: inline-flex; margin-right: 5px; color: var(--muted); vertical-align: -2px; } .ak-site .ak-i { margin: 0 0 0 4px; }
      @media (max-width: 720px) { .ak-row { flex-wrap: wrap; } .ak-side { flex-direction: row; width: 100%; justify-content: space-between; } #ak-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero"><h2 id="ak-title">불러오는 중</h2><p class="lead" id="ak-lead"></p><div class="stats" id="ak-stats"></div></div>
      <div class="card"><div class="card-h"><h2>답 옴</h2><span class="desc">조치 끝나면 [끝]</span></div><div id="ak-new"></div></div>
      <div class="card"><div class="card-h"><h2>답 기다림</h2><span class="desc">오래된 순 · 2일 주황 · 4일 빨강</span></div><div id="ak-wait"></div></div>
      <div class="card"><div class="card-h"><h2>최근 끝난 문의</h2><span class="desc">지난 14일</span></div><div id="ak-done"></div></div>`;
    document.addEventListener('barun:page', (e) => { if (e.detail === 'asks') { load(); start(); } else stop(); });
    if (!sec.hidden) start();
    load();   // 탭 숫자(답 옴)는 처음부터
    setInterval(() => { if (!document.hidden && $('p-asks').hidden) load(); }, 120000);
    return true;
  }

  const start = () => { stop(); timer = setInterval(() => { if (!document.hidden && !$('p-asks').hidden) load(); }, 30000); };
  const stop = () => { if (timer) clearInterval(timer); timer = 0; };
  const stat = (k, v, d, cls) => { const s = E('div', 'stat ' + (cls || '')); s.style.cursor = 'default'; s.append(E('div', 'k', k), E('div', 'v', v), E('div', 'd', d || '')); return s; };
  const day = (iso) => !iso ? '' : String(iso).slice(5, 16).replace('T', ' ').replace('-', '/');
  const ageTxt = (a) => a < 1 ? `${Math.round(a * 24)}시간` : `${Math.floor(a)}일 ${Math.round((a % 1) * 24)}시간`;

  async function setState(id, state, b) {
    b.disabled = true;
    try {
      const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ask', key: id, state }) });
      const j = await r.json(); if (window.toast) window.toast(j.msg); load();
    } catch (e) { b.disabled = false; }
  }

  function row(r) {
    const d = E('div', 'ak-row');
    const body = E('div', 'ak-body');
    body.append(E('div', 'ak-t', noE(r.title) || r.no));
    const meta = [`글 ${r.no}`, r.ref, `보냄 ${day(r.sent_at)}`, r.by].filter(Boolean).join(' · ');
    body.append(E('div', 'ak-m', meta));
    if (r.memo) { const m = E('div', 'ak-m'); m.append(ic('edit'), document.createTextNode(noE(r.memo))); body.append(m); }
    if (r.answer) { const a = E('div', 'ak-a'); if (r.state !== '기다림') a.append(ic('chat')); a.append(document.createTextNode(noE(r.answer))); body.append(a); }
    const side = E('div', 'ak-side');
    const [lab, cls] = LVL[r.level] || ['', ''];
    const top = E('div'); top.append(E('span', 'badge ' + cls, lab), document.createTextNode(' '), E('span', 'ak-age', r.state === '끝' ? day(r.answered_at || r.updated) : ageTxt(r.age)));
    side.append(top);
    const bt = E('div', 'ak-btns');
    if (r.url) { const a = E('a', 'btn sm ghost', '글 열기'); a.append(ic('external')); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; bt.append(a); }
    if (r.state !== '끝') { const b = E('button', 'btn sm', '끝'); b.type = 'button'; b.title = '조치까지 끝났으면'; b.onclick = () => setState(r.id, '끝', b); bt.append(b); }
    if (r.state === '답 옴') { const b = E('button', 'btn sm ghost', '다시 물었어요'); b.type = 'button'; b.onclick = () => setState(r.id, '기다림', b); bt.append(b); }
    side.append(bt);
    const site = E('div', 'ak-site', r.site); if (!r.auto) { site.append(ic('hand')); site.title = '답을 직접 확인하는 곳'; }
    d.append(site, body, side);
    return d;
  }
  const fill = (id, list, emptyText) => { const c = $(id); c.innerHTML = ''; if (!list.length) c.append(E('div', 'muted small', emptyText)); for (const r of list) c.append(row(r)); };

  function render(d) {
    const nNew = d.answered.length, nWait = d.waiting.length, nOver = d.overdue.length;
    if (window.barunBadge) window.barunBadge('asks', nNew);   // 메뉴 숫자(답 옴)
    $('ak-title').textContent = nNew ? `답 옴 ${nNew}건 확인` : nOver ? `2일 넘게 답 없음 ${nOver}건` : nWait ? `답 기다림 ${nWait}건` : '열린 문의 없음';
    $('ak-lead').textContent = `답 자동 확인 ${d.auto_pct ?? '—'}% · 손 모양은 직접 확인`;
    const st = $('ak-stats'); st.innerHTML = '';
    st.append(stat('답 옴', String(nNew), '확인 필요', nNew ? 'run' : ''), stat('기다림', String(nWait), Object.entries(d.by_site).map(([k, v]) => v ? `${k} ${v}` : '').filter(Boolean).join(' · ')),
      stat('2일 넘음', String(nOver), '재촉 검토', nOver ? 'warn' : 'ok'), stat('최근 끝', String(d.done.length), '지난 14일', ''));
    fill('ak-new', d.answered, '없음');
    fill('ak-wait', [...d.waiting].sort((a, b) => b.age - a.age), '없음');
    fill('ak-done', d.done, '없음');
  }

  async function load() {
    if (busy) return; busy = true;
    try { const r = await (window.barunFetch || fetch)('/api/asks'); if (r.ok) render(await r.json()); }
    catch (e) { /* 토큰 창은 barunFetch가 띄움 */ } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
