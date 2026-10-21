// 에이전트 활동 타임라인 (2026-10-21) — 줄마다 회차 막대(시작→끝·상태)와 그 시각에 한 일(일지·알림·발주확인·쓰기).
// 데이터: /api/timeline?hours=N (dashboard/timeline.py). 그리기: 순수 SVG + HTML 툴팁, 외부 라이브러리 없음.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const RANGES = [[12, '12시간'], [24, '24시간'], [72, '3일'], [168, '7일']];
  const STATUS = {
    ok: { label: '정상', icon: '✓', cls: 'st-ok' },
    fail: { label: '실패', icon: '✕', cls: 'st-fail' },
    running: { label: '진행 중', icon: '●', cls: 'st-run' },
    stale: { label: '멈춤 의심', icon: '!', cls: 'st-stale' },
    skip: { label: '건너뜀(할 일 없음)', icon: '–', cls: 'st-skip' },
  };
  const SEV = { urgent: ['긴급', 'mk-crit'], critical: ['긴급', 'mk-crit'], todo: ['오늘', 'mk-high'], high: ['오늘', 'mk-high'], info: ['참고', 'mk-info'], debug: ['기록만', 'mk-debug'] };
  const KIND = { notify: '알림', log: '일지', ops: '프로그램', write: '쓰기', hub: '허브 감지' };
  const LABEL_W = 230, LANE_H = 44, GROUP_H = 26, AXIS_H = 34, PAD_R = 18;

  let hours = 24, data = null, pinned = null;
  try { hours = +localStorage.getItem('barun.activity.hours') || 24; } catch (e) { /* 저장소 없음 */ }

  const $ = (id) => document.getElementById(id);
  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const T = (s) => new Date(s.length === 19 ? s + '+09:00' : s);
  const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  const dur = (s) => s == null ? '' : s < 90 ? `${s}초` : s < 5400 ? `${Math.round(s / 60)}분` : `${(s / 3600).toFixed(1)}시간`;

  function controls() {
    const box = $('act-controls'); box.textContent = '';
    const seg = h('div', 'segctl');
    for (const [v, lab] of RANGES) {
      const b = h('button', v === hours ? 'on' : '', lab);
      b.type = 'button'; b.setAttribute('aria-pressed', v === hours);
      b.onclick = () => { hours = v; try { localStorage.setItem('barun.activity.hours', v); } catch (e) { /* 무시 */ } load(); };
      seg.append(b);
    }
    box.append(seg);
    const lg = h('div', 'legend');
    const item = (sw, text) => { const s = h('span', 'lg'); s.append(sw, document.createTextNode(text)); lg.append(s); };
    for (const k of ['ok', 'fail', 'running', 'stale']) { const sw = h('span', 'sw bar ' + STATUS[k].cls, STATUS[k].icon); item(sw, STATUS[k].label); }
    item(h('span', 'sw bar planned'), '예정');
    item(h('span', 'sw skipdot'), '건너뜀(할 일 없음)');
    item(h('span', 'sw dot mk-crit'), '알림 긴급');
    item(h('span', 'sw dot mk-high'), '알림 오늘 처리');
    item(h('span', 'sw dot mk-info'), '알림 참고');
    item(h('span', 'sw sq'), '일지');
    item(h('span', 'sw tri'), '프로그램');
    item(h('span', 'sw dia'), '허브 감지→처리');
    item(h('span', 'sw tick'), '쓰기');
    box.append(lg);
    const tb = h('button', 'linkbtn', '표로 보기');
    tb.type = 'button';
    tb.onclick = () => { const t = $('act-table'); t.hidden = !t.hidden; tb.textContent = t.hidden ? '표로 보기' : '표 닫기'; };
    box.append(tb);
  }

  function ticksFor(t0, t1, width) {
    const spanH = (t1 - t0) / 36e5;
    const steps = [1, 2, 3, 6, 12, 24];
    const step = steps.find(s => (spanH / s) * 64 <= width) || 24;
    const out = [];
    const d = new Date(t0); d.setMinutes(0, 0, 0);
    while (d <= t1) { if (d >= t0 && d.getHours() % step === 0) out.push(new Date(d)); d.setHours(d.getHours() + 1); }
    return out;
  }

  // 가까운 점은 묶는다(px 간격 기준) — 쓰기 140건도 읽히게
  function cluster(markers, x, gap) {
    const out = [];
    for (const m of markers) {
      const px = x(T(m.at));
      const last = out[out.length - 1];
      if (last && px - last.px1 < gap && last.kind === m.kind) { last.items.push(m); last.px1 = px; }
      else out.push({ kind: m.kind, px0: px, px1: px, items: [m] });
    }
    return out;
  }

  function worstLevel(items) {
    const order = ['urgent', 'critical', 'fail', 'todo', 'high', 'info', 'ok', 'debug', ''];
    return items.map(i => i.level || '').sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
  }

  function render() {
    if (!data) return;
    const wrap = $('act-chart');
    const tipNode = $('act-tip'); wrap.textContent = ''; wrap.append(tipNode); tipNode.hidden = true;
    const width = Math.max(wrap.clientWidth, 640);
    const lanes = data.lanes;
    const groups = [...new Set(lanes.map(l => l.group))];
    const height = AXIS_H + groups.length * GROUP_H + lanes.length * LANE_H + 8;
    const t0 = T(data.start), t1 = T(data.end), now = T(data.now);
    const plotW = width - LABEL_W - PAD_R;
    const x = (d) => LABEL_W + ((d - t0) / (t1 - t0)) * plotW;
    const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img',
      'aria-label': `에이전트 활동 타임라인, 최근 ${data.hours}시간` }, wrap);

    // 날짜 띠(하루씩 번갈아) + 밤 시간(00~07) 음영
    const day = new Date(t0); day.setHours(0, 0, 0, 0);
    let alt = 0;
    while (day < t1) {
      const n = new Date(day); n.setDate(n.getDate() + 1);
      const a = Math.max(x(day), LABEL_W), b = Math.min(x(n), width - PAD_R);
      if (b > a) {
        if (alt % 2) svgEl('rect', { x: a, y: AXIS_H, width: b - a, height: height - AXIS_H, class: 'dayband' }, svg);
        const nightEnd = new Date(day); nightEnd.setHours(7);
        const na = Math.max(x(day), LABEL_W), nb = Math.min(x(nightEnd), width - PAD_R);
        if (nb > na) svgEl('rect', { x: na, y: AXIS_H, width: nb - na, height: height - AXIS_H, class: 'night' }, svg);
        if (x(day) >= LABEL_W) svgEl('text', { x: x(day) + 4, y: 12, class: 'axis-date' }, svg).textContent = `${md(day)} (${'일월화수목금토'[day.getDay()]})`;
      }
      day.setDate(day.getDate() + 1); alt++;
    }
    // 시각 눈금
    for (const d of ticksFor(t0, t1, plotW)) {
      const px = x(d);
      svgEl('line', { x1: px, x2: px, y1: AXIS_H - 6, y2: height, class: 'grid' }, svg);
      if (px < x(now) - 18 || px > x(now) + 78)   // '지금 HH:MM' 글자와 겹치는 눈금 글자는 뺀다
        svgEl('text', { x: px, y: AXIS_H - 10, class: 'axis', 'text-anchor': 'middle' }, svg).textContent = `${d.getHours()}시`;
    }

    let y = AXIS_H;
    const tip = $('act-tip');
    const showTip = (ev, html) => {
      tip.textContent = ''; tip.append(html); tip.hidden = false;
      const r = wrap.getBoundingClientRect();
      let left = ev.clientX - r.left + 14, top = ev.clientY - r.top + 14;
      if (left + 320 > r.width) left = ev.clientX - r.left - 330;
      tip.style.left = `${Math.max(4, left)}px`; tip.style.top = `${top}px`;
    };
    const hideTip = () => { tip.hidden = true; };
    const bind = (node, contentFn, pinFn) => {
      node.addEventListener('mousemove', (e) => showTip(e, contentFn()));
      node.addEventListener('mouseleave', hideTip);
      node.addEventListener('click', () => { pinned = pinFn(); showPinned(); });
      node.setAttribute('tabindex', '0');
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter') { pinned = pinFn(); showPinned(); } });
    };

    for (const g of groups) {
      svgEl('text', { x: 12, y: y + 17, class: 'group' }, svg).textContent = g;
      svgEl('line', { x1: 12, x2: width - PAD_R, y1: y + GROUP_H - 2, y2: y + GROUP_H - 2, class: 'groupline' }, svg);
      y += GROUP_H;
      for (const ln of lanes.filter(l => l.group === g)) {
        const cy = y + 16, my = y + 34;
        // 줄 이름(분야 색 띠 + 이름 + 실행 방식 + 요약)
        svgEl('rect', { x: 12, y: y + 6, width: 4, height: LANE_H - 12, rx: 2, fill: ln.color }, svg);
        svgEl('text', { x: 24, y: y + 19, class: 'lane' }, svg).textContent = `${ln.icon || ''} ${ln.label}`.trim();
        const st = ln.stats;
        const sub = [ln.runner, st.runs ? `회차 ${st.runs} · 실패 ${st.fail}` : '', st.skips ? `건너뜀 ${st.skips}` : '', st.avg_secs ? `평균 ${dur(st.avg_secs)}` : '', st.events ? `기록 ${st.events}` : '']
          .filter(Boolean).join(' · ');
        svgEl('text', { x: 24, y: y + 35, class: 'lane-sub' }, svg).textContent = sub;
        svgEl('line', { x1: LABEL_W, x2: width - PAD_R, y1: y + LANE_H, y2: y + LANE_H, class: 'laneline' }, svg);

        // 지난 예정 시각(작은 눈금) — 회차가 빠졌으면 눈금만 남는다
        for (const s of ln.slots || []) {
          const px = x(T(s));
          svgEl('line', { x1: px, x2: px, y1: cy - 10, y2: cy - 6, class: 'slot' }, svg);
        }
        // 앞으로 예정
        for (const p of ln.planned || []) {
          const px = x(T(p)), w = Math.max(6, ((ln.stats.avg_secs || 600) * 1000 / (t1 - t0)) * plotW);
          const r = svgEl('rect', { x: px, y: cy - 7, width: w, height: 14, rx: 4, class: 'planned' }, svg);
          bind(r, () => tipBox(`${ln.label} 예정`, [`${md(T(p))} ${hm(T(p))} 예정`, ln.runner && `실행: ${ln.runner}`]),
            () => ({ lane: ln, title: `${ln.label} — 예정 회차`, rows: [['시각', `${md(T(p))} ${hm(T(p))}`], ['실행', ln.runner || '-']] }));
        }
        // 회차 막대
        for (const s of ln.segments) {
          if (s.status === 'skip') {   // 문지기가 건너뛴 회차: 막대 대신 속 빈 동그라미(정상 막대에 가리지 않게 위에)
            const c = svgEl('circle', { cx: x(T(s.start)), cy: cy + 11, r: 3.5, class: 'skipdot' }, svg);
            const rows = [`${md(T(s.start))} ${hm(T(s.start))} · 건너뜀`, s.detail || '할 일 없음 — 에이전트를 띄우지 않음'];
            bind(c, () => tipBox(ln.label, rows), () => ({ lane: ln, title: `${ln.label} — 건너뛴 회차`, rows: [['시각', rows[0]], ['이유', rows[1]]] }));
            continue;
          }
          const a = Math.max(x(T(s.start)), LABEL_W);
          const b = Math.min(x(s.end ? T(s.end) : now), width - PAD_R);
          const w = Math.max(b - a, 6);
          const meta = STATUS[s.status] || STATUS.ok;
          const r = svgEl('rect', { x: a, y: cy - 7, width: w, height: 14, rx: 4, class: 'bar ' + meta.cls }, svg);
          if (w > 22) svgEl('text', { x: a + 6, y: cy + 4, class: 'bar-icon' }, svg).textContent = meta.icon;
          for (const stp of s.steps || []) svgEl('circle', { cx: x(T(stp.at)), cy, r: 2, class: 'step' }, svg);
          const rows = [`${md(T(s.start))} ${hm(T(s.start))} → ${s.end ? hm(T(s.end)) : '진행 중'} · ${dur(s.secs)}`,
            `${meta.icon} ${meta.label}${s.runner ? ' · ' + s.runner : ''}`, s.title,
            (s.steps || []).length ? `단계: ${s.steps.map(z => z.step).join(' → ')}` : '', s.detail];
          bind(r, () => tipBox(ln.label, rows), () => ({ lane: ln, title: `${ln.label} — ${s.title}`, rows: [
            ['시간', rows[0]], ['상태', `${meta.icon} ${meta.label}`], ['실행', s.runner || (ln.kind === 'claude-desktop' ? '데스크톱 앱' : '-')],
            ['단계', (s.steps || []).map(z => `${hm(T(z.at))} ${z.step}`).join('\n') || '-'], ['마지막 답·내용', s.detail || '-']] }));
        }
        // 한 일(점) — 묶어서
        for (const c of [...cluster(ln.markers.filter(m => m.kind === 'write' || m.kind === 'ops'), (d) => x(d), 16),
                         ...cluster(ln.markers.filter(m => m.kind !== 'write' && m.kind !== 'ops'), (d) => x(d), 8)]) {
          const px = (c.px0 + c.px1) / 2, n = c.items.length, lvl = worstLevel(c.items);
          let node;
          if (c.kind === 'notify') {
            const cls = (SEV[lvl] || SEV.info)[1];
            node = svgEl('circle', { cx: px, cy: my, r: n > 1 ? 5.5 : 4.5, class: 'mk ' + cls }, svg);
          } else if (c.kind === 'log') {
            node = svgEl('rect', { x: px - 4, y: my - 4, width: 8, height: 8, rx: 1.5, class: 'mk mk-log' }, svg);
          } else if (c.kind === 'hub') {   // 이벤트 허브 사건: 마름모(실패 빨강·할 일 주황·정상 초록)
            const cls = lvl === 'fail' ? 'mk-crit' : lvl === 'todo' ? 'mk-high' : lvl === 'info' ? 'mk-info' : 'mk-hubok';
            node = svgEl('path', { d: `M${px} ${my - 6} L${px + 6} ${my} L${px} ${my + 6} L${px - 6} ${my} Z`, class: 'mk ' + cls }, svg);
          } else if (c.kind === 'ops') {
            node = svgEl('path', { d: `M${px} ${my - 5} L${px + 5} ${my + 4} L${px - 5} ${my + 4} Z`, class: 'mk mk-ops' }, svg);
          } else {
            node = svgEl('rect', { x: px - 2, y: my - 6, width: 4, height: 12, rx: 1.5, class: 'mk mk-write' }, svg);
          }
          // 묶음 안 실패는 따로: 작은 빨간 점 + 실패 수(묶음 전체를 빨갛게 칠하지 않는다)
          const fails = c.items.filter(m => m.level === 'fail').length;
          if (fails) svgEl('circle', { cx: px, cy: my - 9, r: 3, class: 'mk-failpip' }, svg);
          if (n > 1) svgEl('text', { x: px + 7, y: my + 4, class: 'count' }, svg).textContent = fails ? `${n}(실패 ${fails})` : n;
          const first = T(c.items[0].at), last = T(c.items[n - 1].at);
          const head = `${KIND[c.kind]} ${n > 1 ? n + '건 · ' : ''}${hm(first)}${n > 1 ? '–' + hm(last) : ''}`;
          bind(node, () => tipBox(`${ln.label} · ${head}`, c.items.slice(-6).reverse().map(m => `${hm(T(m.at))} ${m.level && SEV[m.level] ? '[' + SEV[m.level][0] + '] ' : ''}${m.title}`)
            .concat(n > 6 ? [`… 외 ${n - 6}건 (눌러서 전체)`] : [])),
            () => ({ lane: ln, title: `${ln.label} — ${head}`, items: c.items }));
        }
        y += LANE_H;
      }
    }
    // 지금 선
    const nx = x(now);
    svgEl('line', { x1: nx, x2: nx, y1: AXIS_H - 4, y2: height, class: 'now' }, svg);
    svgEl('text', { x: nx + 4, y: AXIS_H - 10, class: 'now-label' }, svg).textContent = `지금 ${hm(now)}`;
    renderTable();
  }

  function tipBox(title, rows) {
    const f = document.createDocumentFragment();
    f.append(h('div', 'tip-title', title));
    for (const r of rows.filter(Boolean)) f.append(h('div', 'tip-row', String(r).slice(0, 260)));
    return f;
  }

  function showPinned() {
    const box = $('act-detail'); box.textContent = '';
    if (!pinned) { box.append(h('p', 'muted small', '막대나 점을 누르면 여기에 자세히 나옵니다.')); return; }
    box.append(h('h3', null, pinned.title));
    if (pinned.rows) {
      const dl = h('dl', 'kv');
      for (const [k, v] of pinned.rows) { dl.append(h('dt', null, k)); const dd = h('dd'); dd.append(h('pre', null, v)); dl.append(dd); }
      box.append(dl);
    }
    if (pinned.items) {
      const ul = h('ul', 'log');
      for (const m of [...pinned.items].reverse()) {
        const li = h('li');
        li.append(h('span', 'muted small', `${md(T(m.at))} ${hm(T(m.at))} · ${KIND[m.kind]} `));
        if (m.level && SEV[m.level]) li.append(h('span', 'chip ' + SEV[m.level][1], SEV[m.level][0]), document.createTextNode(' '));
        li.append(h('span', 'name', m.title));
        if (m.detail) { const d = h('details'); d.append(h('summary', null, '내용'), h('pre', null, m.detail)); li.append(d); }
        if (m.ref) { const a = h('a', 'small', ' 알림 기록에서 보기'); a.href = '#ev-' + m.ref; li.append(a); }
        ul.append(li);
      }
      box.append(ul);
    }
  }

  function renderTable() {
    const t = $('act-table'); t.textContent = '';
    const rows = [];
    for (const ln of data.lanes) {
      for (const s of ln.segments) rows.push([s.start, ln.label, '회차', `${(STATUS[s.status] || {}).label || s.status} · ${dur(s.secs)}${s.runner ? ' · ' + s.runner : ''}`, s.title]);
      for (const m of ln.markers) rows.push([m.at, ln.label, KIND[m.kind], m.level && SEV[m.level] ? SEV[m.level][0] : (m.level || ''), m.title]);
    }
    rows.sort((a, b) => b[0].localeCompare(a[0]));
    const table = h('table');
    const thead = h('thead'); const tr = h('tr');
    for (const c of ['시각', '줄', '종류', '상태', '내용']) tr.append(h('th', null, c));
    thead.append(tr); table.append(thead);
    const tb = h('tbody');
    for (const r of rows.slice(0, 400)) {
      const row = h('tr');
      row.append(h('td', 'small', `${md(T(r[0]))} ${hm(T(r[0]))}`), h('td', null, r[1]), h('td', null, r[2]), h('td', 'small', r[3]), h('td', null, r[4]));
      tb.append(row);
    }
    table.append(tb); t.append(table);
  }

  async function load() {
    controls();
    try {
      const r = await (window.barunFetch || fetch)(`/api/timeline?hours=${hours}`, { cache: 'no-store' });
      data = await r.json();
      render(); showPinned();
    } catch (e) {
      $('act-chart').textContent = '타임라인을 불러오지 못했습니다: ' + e;
    }
  }

  window.addEventListener('resize', () => { clearTimeout(window.__actRs); window.__actRs = setTimeout(render, 150); });
  window.barunReloadTimeline = load;
  load();
  setInterval(load, 60000);
})();
