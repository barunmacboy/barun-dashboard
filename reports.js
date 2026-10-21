// 📑 시트 보고서 — 구글 시트에만 있던 보고 탭(전체현황·매출분석·판매점검·메일정리·설정)을 현황판 '기록' 탭에서 (2026-10-22 사장님: 시트를 안 써도 될 만큼).
// 자료: GET /api/db/grid?tab= (dashboard/dbview.py — 주문 장부 원본 barun.db 격자, ops/gridstore.py). 보고 탭은 각 회차가 다시 쓰고, 여기서는 보기만.
// 설정 탭만 노란 칸(직접환율·탭 기본통화·배대지센터·고정비)을 고칠 수 있다 → POST /api/action {action:"db", kind:"settings_set"} → ops/orderedit.settings.
// 그리기: 빈 줄로 나뉜 덩어리마다 — 첫 칸만 있는 줄은 소제목, 그 다음 줄은 머리글, 나머지는 표(덩어리 안에서 늘 빈 열은 뺌).
(() => {
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const fetchJ = async (p, opts) => (await (window.barunFetch || fetch)(p, opts)).json();
  const DESC = { 전체현황: '진행 중 주문 요약 — 주문 갱신 때마다 다시 써요', 매출분석: '이번 달 매출·순이익 — 하루 마감 때 다시 써요', 판매점검: '쿠팡 판매 점검(⑦) 보고',
    메일정리: '네이버 메일 정리(⑤) 보고', 설정: '환율·탭 기본값 — 노란 칸을 고치면 다음 주문 갱신부터 수익 계산에 써요' };
  let cur = '전체현황', data = null, pending = {}, note = '';
  const card = () => document.getElementById('rep-card');

  function blocks(g) {
    const out = []; let b = [];
    g.forEach((row, i) => {
      if (!row.some((c) => String(c).trim())) { if (b.length) out.push(b); b = []; return; }
      b.push({ i: i + 1, row });
    });
    if (b.length) out.push(b);
    return out;
  }
  const solo = (row) => row.filter((c) => String(c).trim()).length === 1 && String(row[0]).trim();
  const editable = (r, c) => (data.editable || []).some(([a, b]) => a === r && b === c);

  function table(rows, head) {
    const used = new Set();
    for (const { row } of [head, ...rows].filter(Boolean)) row.forEach((c, j) => { if (String(c).trim()) used.add(j); });
    rows.forEach(({ i, row }) => row.forEach((c, j) => { if (editable(i, j + 1)) used.add(j); }));
    const cols = [...used].sort((a, b) => a - b);
    const wrap = E('div', 'rep-wrap'); const t = E('table', 'rep');
    if (head) { const tr = E('tr'); for (const j of cols) tr.append(E('th', null, head.row[j] || '')); const th = E('thead'); th.append(tr); t.append(th); }
    const tb = E('tbody');
    for (const { i, row } of rows) {
      const tr = E('tr');
      for (const j of cols) {
        const v = row[j] || '';
        const td = E('td', /^[-+]?[\d,.]+(원|%|건|개|만원)?$/.test(v.trim()) ? 'num' : v.length > 40 ? 'long' : null);
        if (v.length > 18) td.title = v;
        if (editable(i, j + 1)) {
          const k = `${i}:${j + 1}`, inp = E('input', 'rep-in'); inp.value = k in pending ? pending[k].new : v;
          inp.setAttribute('aria-label', `${row[0]} ${head ? head.row[j] : ''}`);
          inp.oninput = () => { if (inp.value.trim() === v) delete pending[k]; else pending[k] = { row: i, col: j + 1, old: v, new: inp.value.trim() }; bar(); };
          td.classList.add('ed'); td.append(inp);
        } else td.textContent = v;
        tr.append(td);
      }
      tb.append(tr);
    }
    t.append(tb); wrap.append(t); return wrap;
  }

  // ── 매출분석 그래프(보고서 'report' 동작의 그래프 정의 + 격자의 숫자) — 색: 네이버 3번(청록)·쿠팡 2번(주황)·합계 1번(파랑), 검사기 통과 ──
  const SERIES = { 네이버: 'var(--rep-s3)', 쿠팡: 'var(--rep-s2)', 합계: 'var(--rep-s1)' };
  const num = (v) => { const n = +String(v || '').replace(/[^\d.-]/g, ''); return isNaN(n) ? 0 : n; };
  const man = (v) => (Math.abs(v) >= 1e4 ? (v / 1e4).toLocaleString('ko-KR', { maximumFractionDigits: v >= 1e6 ? 0 : 1 }) + '만' : v.toLocaleString('ko-KR')) + '원';
  const NS = 'http://www.w3.org/2000/svg';
  const S = (tag, attrs, txt) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); if (txt != null) e.textContent = txt; return e; };
  const range = (c) => { const rows = []; for (let i = 0; i < c.rows; i++) { const r = (data.grid[c.row - 1 + i] || []); rows.push(r.slice(c.col - 1, c.col - 1 + c.cols)); } return rows; };
  const legend = (names) => { const l = E('div', 'ch-legend'); for (const n of names) { const it = E('span', 'ch-key'); const sw = E('i'); sw.style.background = SERIES[n] || 'var(--rep-s1)'; it.append(sw, document.createTextNode(n)); l.append(it); } return l; };

  function lineChart(c) {
    const rows = range(c), head = rows[0], body = rows.slice(1).filter((r) => r[0]);
    const names = head.slice(1);
    const box = E('figure', 'ch'); box.append(E('figcaption', 'ch-t', c.title || '최근 30일 일별 매출'), legend(names));
    const W = 720, H = 220, L = 52, R = 12, T = 10, B = 24;
    const max = Math.max(1, ...body.flatMap((r) => r.slice(1).map(num)));
    const step = Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 2 : max / Math.pow(10, Math.floor(Math.log10(max))) > 2 ? 1 : 0.5);
    const top = Math.ceil(max / step) * step;
    const x = (i) => L + (W - L - R) * (body.length < 2 ? 0.5 : i / (body.length - 1)), y = (v) => T + (H - T - B) * (1 - v / top);
    const svg = S('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ch-svg', role: 'img', 'aria-label': `${c.title || '일별 매출'} 선 그래프` });
    for (let v = 0; v <= top + 1e-9; v += step) { svg.append(S('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'ch-grid' }), S('text', { x: L - 6, y: y(v) + 4, class: 'ch-ax', 'text-anchor': 'end' }, man(v))); }
    body.forEach((r, i) => { if (i % 5 === 0 || i === body.length - 1) svg.append(S('text', { x: x(i), y: H - 6, class: 'ch-ax', 'text-anchor': 'middle' }, r[0])); });
    names.forEach((n, k) => {
      const d = body.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(num(r[k + 1])).toFixed(1)}`).join('');
      svg.append(S('path', { d, class: 'ch-line', stroke: SERIES[n] || 'var(--rep-s1)' }));
    });
    const cross = S('line', { y1: T, y2: H - B, class: 'ch-cross', visibility: 'hidden' }); svg.append(cross);
    const dots = names.map((n) => { const d = S('circle', { r: 4, class: 'ch-dot', fill: SERIES[n] || 'var(--rep-s1)', visibility: 'hidden' }); svg.append(d); return d; });
    const tip = E('div', 'ch-tip'); tip.hidden = true;
    const hit = S('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent' }); svg.append(hit);
    const move = (ev) => {
      const pt = svg.getBoundingClientRect(); const fx = (ev.clientX - pt.left) / pt.width * W;
      const i = Math.max(0, Math.min(body.length - 1, Math.round((fx - L) / ((W - L - R) / Math.max(1, body.length - 1)))));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
      dots.forEach((d, k) => { d.setAttribute('cx', x(i)); d.setAttribute('cy', y(num(body[i][k + 1]))); d.setAttribute('visibility', 'visible'); });
      tip.textContent = ''; tip.append(E('b', null, body[i][0]));
      names.forEach((n, k) => { const ln = E('div', 'ch-tl'); const sw = E('i'); sw.style.background = SERIES[n] || 'var(--rep-s1)'; ln.append(sw, document.createTextNode(`${n} ${man(num(body[i][k + 1]))}`)); tip.append(ln); });
      tip.hidden = false; const px = x(i) / W * pt.width; tip.style.left = `${Math.min(pt.width - 150, Math.max(0, px + 12))}px`; tip.style.top = '8px';
    };
    hit.addEventListener('pointermove', move); hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); });
    const wrap = E('div', 'ch-plot'); wrap.append(svg, tip); box.append(wrap);
    return box;
  }

  function shareChart(c) {      // 판매처 비율 — 조각 둘은 원보다 한 줄 막대가 읽기 쉬움
    const rows = range(c).slice(1).filter((r) => r[0]); const tot = rows.reduce((a, r) => a + num(r[1]), 0) || 1;
    const box = E('figure', 'ch'); box.append(E('figcaption', 'ch-t', c.title || '판매처 비율'));
    const bar = E('div', 'ch-share'); bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', rows.map((r) => `${r[0]} ${Math.round(num(r[1]) / tot * 100)}%`).join(', '));
    for (const r of rows) { const seg = E('span'); seg.style.flexGrow = String(num(r[1])); seg.style.background = SERIES[r[0]] || 'var(--rep-s1)'; seg.title = `${r[0]} ${man(num(r[1]))}`; bar.append(seg); }
    const lab = E('div', 'ch-share-l');
    for (const r of rows) { const it = E('span', 'ch-key'); const sw = E('i'); sw.style.background = SERIES[r[0]] || 'var(--rep-s1)'; it.append(sw, E('b', null, `${r[0]} ${Math.round(num(r[1]) / tot * 100)}%`), document.createTextNode(` ${man(num(r[1]))}`)); lab.append(it); }
    box.append(bar, lab); return box;
  }

  function barChart(c) {         // 탭별 매출 — 큰 것부터 가로 막대 한 줄씩(값은 막대 끝)
    const rows = range(c).slice(1).filter((r) => r[0]).sort((a, b) => num(b[1]) - num(a[1]));
    const max = Math.max(1, ...rows.map((r) => num(r[1])));
    const box = E('figure', 'ch'); box.append(E('figcaption', 'ch-t', c.title || '탭별 매출'));
    const list = E('div', 'ch-bars');
    for (const r of rows) {
      const row = E('div', 'ch-bar'); row.title = `${r[0]} ${man(num(r[1]))}`;
      const track = E('span', 'ch-track'); const fill = E('i'); fill.style.width = `${Math.max(1, num(r[1]) / max * 100)}%`; track.append(fill);
      row.append(E('span', 'ch-bl', r[0]), track, E('span', 'ch-bv', man(num(r[1]))));
      list.append(row);
    }
    box.append(list); return box;
  }

  function charts() {
    const cs = data.charts || []; if (!cs.length) return null;
    const g = E('div', 'ch-grid');
    for (const c of cs) { try { g.append(c.kind === 'line' ? lineChart(c) : c.kind === 'pie' ? shareChart(c) : barChart(c)); } catch (e) { /* 정의가 격자와 안 맞으면 그 그래프만 건너뜀 */ } }
    return g;
  }

  function render() {
    const box = card(); if (!box || !data) return;
    const body = box.querySelector('.rep-body'); body.textContent = '';
    const chips = box.querySelector('.rep-tabs'); chips.textContent = '';
    for (const t of data.tabs) {
      const b = E('button', 'chipbtn' + (t === cur ? ' on' : ''), t); b.type = 'button'; b.setAttribute('aria-pressed', String(t === cur));
      b.onclick = () => { if (Object.keys(pending).length && !confirm('저장 안 한 칸이 있어요. 버리고 다른 보고서로 갈까요?')) return; pending = {}; note = ''; cur = t; load(); };
      chips.append(b);
    }
    box.querySelector('.rep-desc').textContent = `${DESC[cur] || ''}${data.updated ? ` · ${data.updated.slice(5, 16).replace('T', ' ')} 기준` : ''}`;
    if (!data.grid.length) { body.append(E('p', 'muted', '아직 내용이 없어요')); return; }
    const ch = charts(); if (ch) body.append(ch);
    for (const b of blocks(data.grid)) {
      const sec = E('section', 'rep-sec');
      let rows = b;
      if (solo(rows[0].row)) { sec.append(E(rows[0].i <= 2 ? 'div' : 'h3', rows[0].i <= 2 ? 'rep-lead' : 'rep-h', rows[0].row[0])); rows = rows.slice(1); }
      while (rows.length && solo(rows[0].row) && rows[0].i <= 3) { sec.append(E('div', 'rep-lead', rows[0].row[0])); rows = rows.slice(1); }
      if (rows.length) {
        const multi = rows.filter((r) => r.row.filter((c) => String(c).trim()).length > 1).length;
        const head = rows.length > 1 && multi ? rows[0] : null;
        sec.append(table(head ? rows.slice(1) : rows, head));
      }
      body.append(sec);
    }
    bar();
  }

  function bar() {
    const box = card(); if (!box) return;
    const b = box.querySelector('.rep-bar'); const n = Object.keys(pending).length;
    b.hidden = !n && !note; b.textContent = ''; if (b.hidden) return;
    if (n) {
      const undo = E('button', 'btn sm ghost', '되돌리기'); undo.type = 'button'; undo.onclick = () => { pending = {}; note = ''; render(); };
      const save = E('button', 'btn sm primary', `저장 (${n}칸)`); save.type = 'button';
      save.onclick = async () => {
        save.disabled = true; save.textContent = '저장 중…';
        try {
          const r = await (window.barunFetch || fetch)('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'db', kind: 'settings_set', edits: Object.values(pending) }) });
          const j = await r.json();
          if (j.ok) pending = {};
          note = (j.ok ? '✅ ' : '⚠ ') + j.msg;
        } catch (e) { note = '⚠ ' + e.message; }
        await load();
      };
      b.append(E('b', null, `${n}칸 바뀜`), undo, save);
    }
    if (note) { const o = E('span', 'rep-out', note); o.setAttribute('role', 'status'); b.append(o); }
  }

  async function load() {
    const box = card(); if (!box) return;
    try { data = await fetchJ('/api/db/grid?tab=' + encodeURIComponent(cur)); } catch (e) { box.querySelector('.rep-body').textContent = '불러오지 못했어요: ' + e.message; return; }
    if (data.error) { box.querySelector('.rep-body').textContent = data.error; return; }
    render();
  }

  function build() {
    const panel = document.getElementById('p-records'); if (!panel || card()) return;
    const c = E('div', 'card'); c.id = 'rep-card';
    const h = E('div', 'card-h'); h.append(E('h2', null, '시트 보고서'), E('span', 'desc rep-desc', ''));
    c.append(h, E('div', 'rep-tabs'), Object.assign(E('div', 'rep-bar'), { hidden: true }), E('div', 'rep-body'));
    panel.prepend(c);
  }

  window.barunReports = () => { build(); load(); };
  const pr = document.getElementById('p-records');
  if (pr) {      // 기록 탭이 '숨김 → 보임'으로 바뀔 때만 새로 읽음(같은 값을 다시 써도 바뀜 신호가 와서, 고치던 칸·도움말이 지워지던 것)
    build(); let shown = !pr.hidden;
    new MutationObserver(() => { const now = !pr.hidden; if (now && !shown) load(); shown = now; }).observe(pr, { attributes: true, attributeFilter: ['hidden'] });
    if (shown) load();
  }
})();
