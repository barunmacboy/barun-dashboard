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
  if (pr) { build(); new MutationObserver(() => { if (!pr.hidden) load(); }).observe(pr, { attributes: true, attributeFilter: ['hidden'] }); if (!pr.hidden) load(); }
})();
