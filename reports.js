// 시트 보고서 — 구글 시트에만 있던 보고 탭(전체현황·매출분석·판매점검·메일정리·설정)을 현황판 '보고서' 화면에서 (2026-10-22 사장님: 시트를 안 써도 될 만큼).
// 자료: GET /api/db/grid?tab= (dashboard/dbview.py — 주문 장부 원본 barun.db 격자, ops/gridstore.py). 보고 탭은 각 회차가 다시 쓰고, 여기서는 보기만.
// 설정 탭만 노란 칸(직접환율·탭 기본통화·배대지센터·고정비)을 고칠 수 있다 → POST /api/action {action:"db", kind:"settings_set"} → ops/orderedit.settings.
// 그리기: 빈 줄로 나뉜 덩어리마다 — 첫 칸만 있는 줄은 소제목, 그 다음 줄은 머리글, 나머지는 표(덩어리 안에서 늘 빈 열은 뺌).
(() => {
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  // 2026-11-06: 503 '{}'도 자료로 받아 render가 data.tabs에서 깨지고 '불러오는 중'도 없이 멈췄음 → 응답 코드부터 확인
  const fetchJ = async (p, opts) => { const r = await (window.barunFetch || fetch)(p, opts); if (!r.ok) throw new Error(`서버 응답 ${r.status}`); return r.json(); };
  const DESC = { 전체현황: '진행 중 주문 요약', 매출분석: '이번 달 매출·순이익', 판매점검: '쿠팡 판매 점검',
    메일정리: '네이버 메일 정리', 설정: '환율·탭 기본값 · 노란 칸을 고치면 다음 갱신부터 반영돼요' };
  const LABEL = { 전체현황: '전체 현황', 매출분석: '매출 분석', 판매점검: '판매 점검', 메일정리: '메일 정리' };
  const noE = (t) => (window.noEmoji ? window.noEmoji(t) : String(t ?? ''));
  // 2026-11-12 리뉴얼: 격자 글(서버가 씀)을 화면에 낼 때 — 이모지·파일 이름·업무 번호 덧말은 빼고, ' — '는 '·'로, 습니다체 안내는 해요체로(뜻은 그대로)
  const FIX = [
    [/자동으로 다시 써지는 탭\s*\(수정 금지\)/g, '회차마다 새로 써지는 탭이라 여기서는 고치지 않아요'],
    [/^설정\s*[—–-]\s*노란 칸만 고치세요\.\s*직접환율을 적으면 자동환율 대신 씁니다\.?$/, '노란 칸만 고쳐 주세요. 직접환율을 적으면 자동환율 대신 그 값을 써요.'],
    [/\s*\((?:장부\s+)?[\w./-]+\.(?:jsonl|json|py|db|csv)\)/g, ''],
    [/\s*\([⓪①②③④⑤⑥⑦⑧⑨⑩]\)/g, ''],
    [/\s*\(수정 금지\)/g, ''],
    [/\s+[—–]\s+/g, ' · '],
  ];
  const tidy = (t) => FIX.reduce((x, [re, to]) => x.replace(re, to), noE(t)).trim();
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

  // 보이는 값(2026-10-25 감사: '91·'8.2%·0.0956…·2815000이 그대로 보였음). 새 격자는 ops/gridstore.shown이 서식대로 저장하고, 여기선 옛 격자 대비 —
  // 앞 따옴표(시트의 '글자로 두기' 표시)는 떼고, 순수 숫자만 머리글로 판단: 수익률·비율 칸의 소수 → %, 금액 칸(매출·금액·수익·가격…)의 4자리 넘는 정수 → 쉼표.
  // 번호·송장·코드·전화·ID 칸과 머리글 없는 칸은 그대로(주문번호·송장번호를 숫자로 바꾸지 않게). 환율·세율(율)은 % 칸이 아님.
  const KEEP = /번호|송장|코드|전화|ID|id|key|날짜|일시|시각/, RATE = /률|비율|%/, MONEY = /매출|금액|수익|이익|가격|추천가|광고비|결제|정산|객단가|\(원\)/;
  function shown(v, head) {
    let s = String(v ?? '');
    if (s.startsWith("'")) s = s.slice(1);
    const h = String(head || ''), t = s.trim();
    if (!h || KEEP.test(h) || !/^-?\d+(\.\d+)?$/.test(t)) return s;
    if (RATE.test(h)) return t.includes('.') || +t === 0 ? `${(+t * 100).toFixed(1)}%` : s;
    if (/환율/.test(h)) { const n = +t, d = Math.abs(n) < 100 ? 4 : 2; return n.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }); }   // 엔(JPY)처럼 작은 값은 소수 4자리
    if (MONEY.test(h) && /^-?\d{4,}$/.test(t)) return (+t).toLocaleString('ko-KR');
    return s;
  }
  window.barunReportCell = shown;     // 시험용(dashboard/tests/test_reports_js.py)

  // 한 줄짜리 '없음' 표는 머리글 없이 한 문장으로
  const isEmptyTable = (rows) => rows.length === 1 && rows[0].row.filter((c) => String(c).trim()).every((c) => /^(없음|-|—)$/.test(String(c).trim()));
  // 머리글 + 숫자 한두 줄(매출분석 첫 덩어리)은 숫자 칸으로 — 화면 첫머리 요약
  const isKpi = (rows, head) => head && rows.length >= 1 && rows.length <= 2 && head.row.filter((c) => String(c).trim()).length <= 5
    && rows[0].row.filter((c) => String(c).trim()).every((c) => /\d/.test(String(c)) && String(c).length <= 24);
  function kpis(rows, head) {
    const box = E('div', 'stats rep-kpi');
    head.row.forEach((k, j) => {
      if (!String(k).trim()) return;
      // '212만원 (포인트 48만원)'처럼 괄호 덧말은 큰 숫자 아래 줄로
      const val = tidy(shown(rows[0].row[j], k)), m = val.match(/^(.+?)\s*\((.+)\)$/);
      const st = E('div', 'stat'); st.title = val;
      st.append(E('div', 'k', tidy(k)), E('div', 'v', m ? m[1] : val), E('div', 'd', [m && m[2], rows[1] ? tidy(rows[1].row[j] || '') : ''].filter(Boolean).join(' · ')));
      box.append(st);
    });
    return box;
  }
  function table(rows, head) {
    if (isEmptyTable(rows)) return E('p', 'rep-empty', '지금은 해당하는 줄이 없어요.');
    const used = new Set();
    for (const { row } of [head, ...rows].filter(Boolean)) row.forEach((c, j) => { if (String(c).trim()) used.add(j); });
    rows.forEach(({ i, row }) => row.forEach((c, j) => { if (editable(i, j + 1)) used.add(j); }));
    const cols = [...used].sort((a, b) => a - b);
    const wrap = E('div', 'rep-wrap'); const t = E('table', 'rep');
    if (head) { const tr = E('tr'); for (const j of cols) tr.append(E('th', null, tidy(head.row[j] || ''))); const th = E('thead'); th.append(tr); t.append(th); }
    const tb = E('tbody');
    for (const { i, row } of rows) {
      const tr = E('tr');
      for (const j of cols) {
        const raw = row[j] || '', v = editable(i, j + 1) ? raw : tidy(shown(raw, head ? head.row[j] : ''));
        const hd = head ? String(head.row[j] || '') : '';
        const td = E('td', /^[-+]?[\d,.]+(원|%|건|개|만원)?$/.test(v.trim()) && !KEEP.test(hd) ? 'num' : v.length > 40 ? 'long' : KEEP.test(hd) ? 'id' : null);
        if (hd) td.dataset.h = hd;   // 폰 카드 보기의 칸 이름
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
    t.append(tb); wrap.append(t);
    // 2026-11-06: PC에서 오른쪽 칸(공홈주문번호 등)이 잘려도 옆으로 밀 수 있다는 표시가 없었음 → 넘치면 오른쪽 흐림 + 안내 한 줄
    const hint = E('div', 'rep-hint', '오른쪽으로 밀면 칸이 더 있어요'); hint.hidden = true;
    const edge = () => { const over = wrap.scrollWidth > wrap.clientWidth + 2; hint.hidden = !over; wrap.classList.toggle('more-r', over && wrap.scrollLeft + wrap.clientWidth < wrap.scrollWidth - 2); };
    wrap.addEventListener('scroll', edge, { passive: true }); wrap._edge = edge; requestAnimationFrame(edge);
    const box = E('div'); box.append(hint, wrap); return box;
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
    // 그림이 늘어나도 축 글자는 화면에서 12px(viewBox 배율만큼 줄여 줌)
    if (window.ResizeObserver) new ResizeObserver(() => { const w = svg.getBoundingClientRect().width; if (w) svg.style.setProperty('--ax', `${(12 * W / w).toFixed(2)}px`); }).observe(svg);
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

  // 맨 위 안내 줄: 제목은 굵게, '갱신'이 든 줄은 앞의 숫자(진행 중 22건)만 요약으로 크게 · 나머지는 작고 옅게
  function lead(t, first) {
    if (/갱신/.test(t)) {
      const parts = t.split(' · '), k = parts.findIndex((x) => /갱신/.test(x));
      const sum = parts.slice(0, Math.max(0, k)).filter((x) => /\d/.test(x)), rest = parts.filter((x) => !sum.includes(x));
      return [sum.length && E('div', 'rep-sum', sum.join(' · ')), E('div', 'rep-meta', rest.join(' · '))].filter(Boolean);
    }
    return [E('div', first && t.length <= 30 ? 'rep-title' : first ? 'rep-note' : 'rep-meta', t)];
  }
  function render() {
    const box = card(); if (!box || !data) return;
    const body = box.querySelector('.rep-body'); body.textContent = ''; body.classList.remove('rep-wait'); requestAnimationFrame(() => { body.style.minHeight = ''; });
    const chips = box.querySelector('.rep-tabs'); chips.textContent = '';
    for (const t of data.tabs) {
      const b = E('button', 'chipbtn' + (t === cur ? ' on' : ''), LABEL[t] || t); b.type = 'button'; b.setAttribute('aria-pressed', String(t === cur));
      b.onclick = () => {
        if (t === cur) return;
        if (Object.keys(pending).length && !confirm('저장하지 않은 칸이 있어요. 버리고 넘어갈까요?')) return;
        pending = {}; note = ''; cur = t;
        // 탭을 바꾸는 동안 높이를 잡아 둬 화면이 출렁이지 않게
        body.style.minHeight = `${body.offsetHeight}px`; body.classList.add('rep-wait');
        chips.querySelectorAll('.chipbtn').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
        load();
      };
      chips.append(b);
    }
    box.querySelector('.rep-desc').textContent = `${DESC[cur] || ''}${data.updated ? ` · ${data.updated.slice(5, 16).replace('T', ' ')} 기준` : ''}`;
    if (!data.grid.length) { body.append(E('p', 'rep-empty', '아직 내용이 없어요. 회차가 돌면 채워져요.')); bar(); return; }
    const ch = charts();
    for (const b of blocks(data.grid)) {
      const sec = E('section', 'rep-sec');
      let rows = b;
      if (solo(rows[0].row)) { const t = tidy(rows[0].row[0]); if (rows[0].i <= 2) sec.append(...lead(t, true)); else sec.append(E('h3', 'rep-h', t)); rows = rows.slice(1); }
      while (rows.length && solo(rows[0].row) && rows[0].i <= 3) { sec.append(...lead(tidy(rows[0].row[0]), false)); rows = rows.slice(1); }
      if (rows.length) {
        const multi = rows.filter((r) => r.row.filter((c) => String(c).trim()).length > 1).length;
        const head = rows.length > 1 && multi ? rows[0] : null;
        sec.append(head && isKpi(rows.slice(1), head) ? kpis(rows.slice(1), head) : table(head ? rows.slice(1) : rows, head));
      }
      body.append(sec);
    }
    // 그래프는 맨 위 숫자 칸(요약) 바로 아래에, 숫자 칸이 없으면 맨 위에
    if (ch) { const k = body.querySelector('.rep-kpi'); const after = k && k.closest('.rep-sec'); if (after) after.after(ch); else body.prepend(ch); }
    bar();
  }

  function bar() {
    const box = card(); if (!box) return;
    const b = box.querySelector('.rep-bar'); const n = Object.keys(pending).length;
    b.hidden = !n && !note; b.textContent = ''; if (b.hidden) return;
    if (n) {
      const undo = E('button', 'btn sm ghost', '되돌리기'); undo.type = 'button'; undo.onclick = () => { pending = {}; note = ''; render(); };
      const save = E('button', 'btn sm primary', '저장'); save.type = 'button';
      save.onclick = async () => {
        save.disabled = true; save.textContent = '저장 중…';
        try {
          const r = await (window.barunFetch || fetch)('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'db', kind: 'settings_set', edits: Object.values(pending) }) });
          const j = await r.json().catch(() => ({ ok: false, msg: `서버가 응답하지 않아요(${r.status}). 잠시 뒤 다시 저장해 주세요.` }));
          if (j.ok) pending = {};
          note = j.ok ? (j.msg || '저장했어요. 다음 갱신부터 반영돼요.') : `저장하지 못했어요. ${j.msg || '서버가 이유를 주지 않았어요.'}`;
        } catch (e) { note = `저장하지 못했어요. ${e.message}`; }
        await load();
      };
      b.append(E('b', null, `고친 칸 ${n}개`), undo, save);
    }
    if (note) { const o = E('span', 'rep-out', note); o.setAttribute('role', 'status'); b.append(o); }
  }

  // 2026-11-06: 탭을 빨리 바꾸면 늦게 온 앞 탭 답이 뒤 탭 자리에 그려졌음 → 마지막 요청만. 실패하면 [저장] 버튼이 '저장 중…'에 멈춰 있던 것도 다시 그림.
  let seq = 0;
  async function load() {
    const box = card(); if (!box) return;
    const my = ++seq; let j;
    const fail = (t) => { const b = box.querySelector('.rep-body'); b.classList.remove('rep-wait'); b.style.minHeight = ''; b.replaceChildren(E('p', 'rep-empty', t)); bar(); };
    try { j = await fetchJ('/api/db/grid?tab=' + encodeURIComponent(cur)); } catch (e) { if (my !== seq || e.message === '로그인 필요') return; fail(`보고서를 읽지 못했어요(${e.message}). 잠시 뒤 다시 열어 주세요.`); return; }
    if (my !== seq) return;
    if (j.error || !Array.isArray(j.grid)) { fail(j.error || '보고서 자료를 알아보지 못했어요. 잠시 뒤 다시 열어 주세요.'); return; }
    data = j; render();
  }

  function build() {
    const panel = document.getElementById('p-reports'); if (!panel || card()) return;
    const css = E('style'); css.textContent = `
      .rep-wrap.more-r { box-shadow: inset 0 0 0 1px var(--line), inset -24px 0 16px -12px color-mix(in srgb, var(--ink) 16%, transparent); }
      .rep-hint { font-size: 12.5px; color: var(--muted); text-align: right; margin: 0 0 4px; }
      #rep-card .rep-sec { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; min-width: 0; }
      #rep-card .rep-title { font-size: 15px; font-weight: 700; color: var(--ink); }
      #rep-card .rep-sum { font-size: 15px; font-weight: 600; color: var(--ink2); }
      #rep-card .rep-note { font-size: 13.5px; color: var(--sub); }
      #rep-card .rep-meta { font-size: 12.5px; color: var(--muted); margin-top: -4px; }
      #rep-card .rep-h { font-size: 15px; font-weight: 700; margin: 0; }
      .rep-empty { margin: 0; padding: 12px 16px; border-radius: var(--r-sm); background: var(--fill2); font-size: 13.5px; color: var(--muted); }
      #rep-card .rep-kpi .stat { cursor: default; }
      @media (hover: hover) { #rep-card .rep-kpi .stat:hover { transform: none; background: var(--fill2); box-shadow: inset 0 0 0 1px var(--line); } }
      @media (hover: hover) and (prefers-color-scheme: dark) { #rep-card .rep-kpi .stat:hover { box-shadow: none; } }
      #rep-card .rep-kpi .stat .d { white-space: normal; }
      #rep-card .ch-grid { align-items: stretch; }
      #rep-card .ch-svg .ch-ax { font-size: var(--ax, 12px); }
      .rep-body { transition: opacity .2s var(--ease, ease); } .rep-body.rep-wait { opacity: .45; }
      table.rep td.id { white-space: nowrap; font-variant-numeric: tabular-nums; }
      /* 2026-11-06 폰: 표가 4칸만 보이고 나머지는 잘려서 — 줄마다 카드(칸 이름: 값) */
      @media (max-width: 640px) {
        .rep-wrap { box-shadow: none; overflow: visible; } .rep-hint { display: none; }
        table.rep, table.rep tbody, table.rep tr, table.rep td { display: block; width: 100%; box-sizing: border-box; }
        table.rep thead { display: none; } table.rep tr { border: 1px solid var(--line); border-radius: var(--r-sm); padding: 8px 12px; margin-bottom: 8px; }
        table.rep td { border-top: 0; padding: 4px 0; max-width: none; white-space: normal; overflow-wrap: anywhere; text-align: left !important; min-width: 0 !important; }
        table.rep td[data-h]::before { content: attr(data-h) ' '; color: var(--muted); font-size: 12px; margin-right: 8px; }
        table.rep td:empty { display: none; }
      }`;
    document.head.append(css);
    const c = E('div', 'card'); c.id = 'rep-card';
    const h = E('div', 'card-h'); h.append(E('h2', null, '시트 보고서'), E('span', 'desc rep-desc', ''));
    c.append(h, E('div', 'rep-tabs'), Object.assign(E('div', 'rep-bar'), { hidden: true }), E('div', 'rep-body'));
    panel.prepend(c);
  }

  if (window.addEventListener) window.addEventListener('resize', () => document.querySelectorAll('#rep-card .rep-wrap').forEach((w) => w._edge && w._edge()));
  window.barunReports = () => { build(); load(); };
  const pr = document.getElementById('p-reports');
  if (pr) {      // 보고서 화면이 '숨김 → 보임'으로 바뀔 때만 새로 읽음(같은 값을 다시 써도 바뀜 신호가 와서, 고치던 칸·도움말이 지워지던 것)
    build(); let shown = !pr.hidden;
    new MutationObserver(() => { const now = !pr.hidden; if (now && !shown) load(); shown = now; }).observe(pr, { attributes: true, attributeFilter: ['hidden'] });
    if (shown) load();
  }
})();
