// 에이전트 활동 타임라인 (2026-10-21) — 줄마다 회차 막대(시작→끝·상태)와 그 시각에 한 일(일지·알림·발주확인·쓰기).
// 데이터: /api/timeline?hours=N (dashboard/timeline.py). 그리기: 순수 SVG + HTML 툴팁, 외부 라이브러리 없음.
// 2026-11-12 리뉴얼: 기호 설명은 꼭 필요한 것만(나머지는 접어서), 표로 보기는 그림 대신, 화면 글의 내부 키·커밋 번호·파일 경로는 숨김.
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const RANGES = [[12, '12시간'], [24, '24시간'], [72, '3일'], [168, '7일']];
  const STATUS = {
    ok: { label: '정상', icon: '✓', cls: 'st-ok' },
    fail: { label: '실패', icon: '✕', cls: 'st-fail' },
    running: { label: '진행 중', icon: '●', cls: 'st-run' },
    stale: { label: '멈춤 의심', icon: '!', cls: 'st-stale' },
    skip: { label: '건너뜀', icon: '–', cls: 'st-skip' },
  };
  const LEVEL = { ok: '정상', fail: '실패', todo: '할 일', info: '참고' };
  const SEV = { urgent: ['긴급', 'mk-crit'], critical: ['긴급', 'mk-crit'], todo: ['오늘', 'mk-high'], high: ['오늘', 'mk-high'], info: ['참고', 'mk-info'], debug: ['기록만', 'mk-debug'] };
  const KIND = { notify: '알림', log: '일지', ops: '프로그램', write: '판매처 쓰기', hub: '감시 허브' };
  const RUNNER = { claude: 'AI', codex: 'AI(Codex)' };
  const runner = (r) => RUNNER[r] || r || '';
  // 줄 이름·회차 이름의 영어 꼬리 → 우리말
  const LANE = { 'Claude Code 세션': '대화 세션', 'Codex 세션': '대화 세션 · Codex' };
  const SLUG = { mail: '메일', winner: '가격·위너', orders: '주문', forward: '배대지 신청', sales: '판매 점검', close: '마감', sourcing: '소싱', inquiry: '고객문의', hoottown: '훗타운', improve: '개선' };
  const KEY = { collect_confirmed: '발주확인 수집', 'listing.check': '등록 확인', pagestate: '화면 판정', auto_run: '자동 실행 명령', 'order.late': '주문 지연', winner_ask: '위너 승인 요청' };
  const laneName = (l) => LANE[l] || l;
  // 화면 글 정리: 이 화면 고유 낱말(작업 이름·기록 키)만 여기서, 나머지(이음표·파일·커밋 번호·초→분)는 index.html plainText 한 곳(2026-11-12)
  function plain(t) {
    let s = String(t ?? '');
    if (KEY[s.trim()]) return KEY[s.trim()];
    s = s.replace(/^([a-z_]+):\s*/, (m, k) => { const v = window.koLabel ? window.koLabel(k) : k; return v !== k ? `${v}: ` : m; });   // 'later: …' → '나중에: …'
    s = s.replace(/스크립트 시험\(shadow\)/g, '스크립트 비교 회차').replace(/(스크립트 (?:비교 )?회차) · ([a-z]+)\b/g, (m, a, b) => `${a} · ${SLUG[b] || b}`);
    s = s.replace(/\b(?:collect_confirmed|listing\.check|pagestate|auto_run|order\.late|winner_ask)\b/g, (m) => KEY[m]);
    return window.plainText ? window.plainText(s, { strict: true }) : s;
  }
  window.barunActivityPlain = plain;   // 시험용
  const LABEL_W = 230, LANE_H = 44, GROUP_H = 26, AXIS_H = 34, PAD_R = 18;

  let hours = 24, data = null, pinned = null;
  // 2026-11-06 폰: 기호 설명 16개가 한 화면을 다 채우고 그림은 3시간쯤만 보여서 — 좁은 화면은 설명을 접고 처음부터 표로
  const NARROW = matchMedia('(max-width: 720px)');
  let tableOn = NARROW.matches;
  (() => { const st = document.createElement('style'); st.textContent = `
    #act-controls .act-view { margin-left: auto; }
    #act-controls .legend { gap: 8px 16px; font-size: 12.5px; color: var(--sub); align-items: center; }
    #act-controls .lg { gap: 6px; }
    .act-more > summary { font-size: 12.5px; padding: 0; color: var(--muted); }
    .act-more[open] { flex-basis: 100%; }
    .act-more .legend { margin-top: 8px; }
    /* 기호는 10px 이상 */
    .sw.bar { width: 24px; height: 14px; border-radius: 4px; font-size: 10px; line-height: 14px; font-weight: 700; }
    .sw.bar.planned, #act-chart .planned { border: 0; }
    .sw.bar.planned { background: var(--fill); box-shadow: inset 0 0 0 1px var(--axis); }
    .sw.dot { width: 10px; height: 10px; } .sw.sq { width: 10px; height: 10px; border-radius: 2px; }
    .sw.tri { border-left-width: 6px; border-right-width: 6px; border-bottom-width: 10px; }
    .sw.tick { width: 4px; height: 14px; border-radius: 2px; }
    .sw.skipdot { width: 10px; height: 10px; border-width: 2px; }
    .sw.dia { width: 10px; height: 10px; }
    .sw.night { width: 16px; height: 14px; border-radius: 3px; background: color-mix(in srgb, var(--blue) 6%, transparent); box-shadow: inset 0 0 0 1px var(--line); }
    #act-chart .night { fill: color-mix(in srgb, var(--blue) 6%, transparent); }
    #act-chart .planned { fill: var(--fill); stroke: var(--axis); stroke-width: 1; stroke-dasharray: none; }
    #act-chart .count { fill: var(--sub); font-size: 11px; font-weight: 600; }
    #act-tip { border-radius: var(--r-sm); box-shadow: var(--pop); padding: 8px 12px; font-size: 12.5px; max-width: 320px; }
    #act-tip .tip-title { font-size: 13px; color: var(--ink); }
    #act-tip .tip-row { color: var(--sub); line-height: 1.5; }
    #act-table { max-height: 70vh; margin-top: 0; }
    #act-table th, #act-table td:nth-child(-n+4) { white-space: nowrap; }
    #act-table td { font-variant-numeric: tabular-nums; }
    #act-detail .log li { overflow-wrap: anywhere; }
    #act-detail .log li > a { margin-left: 8px; }
    @media (max-width: 720px) {   /* 폰 표: 칸 다섯 개를 좁게 나눠 시각이 한 글자씩 꺾였음 → 줄마다 '시각 · 줄 · 종류 · 상태' 한 줄 + 내용 */
      #act-table { max-height: 70vh; } #act-table table, #act-table tbody, #act-table tr { display: block; } #act-table thead { display: none; }
      #act-table tr { padding: 8px 0; border-bottom: 1px solid var(--line); } #act-table td { display: inline; border: 0; padding: 0 8px 0 0; font-size: 12px; color: var(--muted); white-space: normal; }
      #act-table td:last-child { display: block; font-size: 13.5px; color: var(--ink); margin-top: 4px; }
      .act-legend summary { cursor: pointer; padding: 4px 0; } }`; document.head.append(st); })();
  const applyView = () => { const t = $('act-table'), c = $('act-chart'); if (!t || !c) return; t.hidden = !tableOn; c.hidden = tableOn; };
  try { hours = +localStorage.getItem('barun.activity.hours') || 24; } catch (e) { /* 저장소 없음 */ }

  const $ = (id) => document.getElementById(id);
  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = window.noEmoji ? String(text).split('\n').map(window.noEmoji).join('\n') : text; return e; };
  const T = (s) => new Date(s.length === 19 ? s + '+09:00' : s);
  // 2026-11-12: 기기 시간대로 보이던 시각을 한국 시각으로(업무 흐름·상품 대장처럼 서울 기준) — 눈금·날짜 띠·밤 음영도 KST.
  //   KST는 서머타임 없이 +9시간 고정이라 9시간 민 시각을 UTC 칸으로 읽으면 서울 벽시계
  const K = (t) => { const k = new Date(+t + 9 * 36e5); return { y: k.getUTCFullYear(), mo: k.getUTCMonth() + 1, d: k.getUTCDate(), h: k.getUTCHours(), mi: k.getUTCMinutes(), dow: k.getUTCDay() }; };
  const hm = (d) => { const k = K(d); return `${String(k.h).padStart(2, '0')}:${String(k.mi).padStart(2, '0')}`; };
  const md = (d) => { const k = K(d); return `${String(k.mo).padStart(2, '0')}/${String(k.d).padStart(2, '0')}`; };
  const kstDay0 = (t) => { const k = K(t); return new Date(Date.UTC(k.y, k.mo - 1, k.d) - 9 * 36e5); };   // 그날 KST 0시
  const dur = (s) => s == null ? '' : s < 60 ? `${s}초` : s < 5400 ? `${Math.round(s / 60)}분` : `${(s / 3600).toFixed(1)}시간`;

  function controls() {
    const box = $('act-controls'); box.textContent = '';
    // 화면 설명(index.html의 자리 글)을 쓰임새 한 줄로
    const desc = document.querySelector('#p-activity .card-h .desc'); if (desc) desc.textContent = '누가 언제 무엇을 했는지 시간 순서로 봐요. 막대는 회차, 점은 그때 한 일이에요.';
    const dh = $('act-detail')?.closest('.card')?.querySelector('.card-h h2'); if (dh) dh.textContent = '고른 항목';
    const seg = h('div', 'segctl');
    for (const [v, lab] of RANGES) {
      const b = h('button', v === hours ? 'on' : '', lab);
      b.type = 'button'; b.setAttribute('aria-pressed', v === hours);
      b.onclick = () => { hours = v; try { localStorage.setItem('barun.activity.hours', v); } catch (e) { /* 무시 */ } load(); };
      seg.append(b);
    }
    box.append(seg);
    const lg = h('div', 'legend'), rest = h('div', 'legend');
    const item = (to, sw, text) => { const s = h('span', 'lg'); s.append(sw, document.createTextNode(text)); to.append(s); };
    const bar = (k) => { const sw = h('span', 'sw bar ' + STATUS[k].cls); sw.textContent = STATUS[k].icon; return sw; };   // 그림 기호는 이모지 걸러내기를 거치지 않게
    for (const k of ['ok', 'fail', 'running']) item(lg, bar(k), STATUS[k].label);
    item(lg, h('span', 'sw bar planned'), '예정');
    item(lg, h('span', 'sw skipdot'), '할 일 없어 건너뜀');
    item(lg, h('span', 'sw dot mk-crit'), '긴급 알림');
    item(lg, h('span', 'sw night'), '밤 0~7시');
    item(rest, bar('stale'), STATUS.stale.label);
    item(rest, h('span', 'sw dot mk-high'), '오늘 처리할 알림');
    item(rest, h('span', 'sw dot mk-info'), '참고 알림');
    item(rest, h('span', 'sw sq'), '일지');
    item(rest, h('span', 'sw tri'), '프로그램');
    item(rest, h('span', 'sw dia'), '감시 허브가 찾아 처리');
    item(rest, h('span', 'sw tick'), '쿠팡·네이버 쓰기');
    const more = h('details', 'act-more'); more.append(h('summary', null, '기호 더 보기'), rest); lg.append(more);
    let lgBox = lg;
    if (NARROW.matches) { lgBox = h('details', 'act-legend'); lgBox.append(h('summary', 'small muted', '기호 설명'), lg); }
    box.append(lgBox);
    const lab = () => (tableOn ? '그림으로 보기' : '표로 보기');
    const tb = h('button', 'btn sm act-view', lab());
    tb.type = 'button';
    tb.onclick = () => { tableOn = !tableOn; applyView(); tb.textContent = lab(); if (!tableOn) render(); };
    box.append(tb);
    applyView();
  }

  // 줄 요약 — 회차를 실행 방식별로(2026-10-25: 'claude · 회차 24'가 스크립트·디스코드 작업 회차까지 다 센 것).
  // 업무 줄의 디스코드 작업 회차는 '디스코드 작업' 줄에서 세므로 '작업판 n'으로만 보이고 회차 수에는 안 넣는다(timeline.py stats).
  function laneSub(ln) {
    const st = ln.stats || {}, by = st.by || {};
    const fail = st.fail ? `실패 ${st.fail}` : '';
    const rest = [st.skips ? `건너뜀 ${st.skips}` : '', st.avg_secs ? `평균 ${dur(st.avg_secs)}` : '', st.events ? `기록 ${st.events}` : ''];
    if (ln.id === 'tasks' || !(by.agent || by.script)) {     // 프로그램·디스코드 작업 줄: 예전처럼 회차 수
      const s = [runner(ln.runner), st.runs ? `회차 ${st.runs}` : '', fail, ...rest].filter(Boolean).join(' · ');
      return { full: s, short: s };
    }
    const agent = by.agent ? `AI ${by.agent}` : '', script = by.script ? `스크립트 ${by.script}` : '';
    const task = by.task ? `작업판 ${by.task}` : '', test = by.test ? `권한 시험 ${by.test}` : '';
    const full = [agent, script + (by.shadow ? `(그중 비교만 ${by.shadow})` : ''), task && `${task}(디스코드 작업 줄에서 셈)`, test, fail, ...rest].filter(Boolean).join(' · ');
    return { full, short: [agent, script, fail, task].filter(Boolean).slice(0, 3).join(' · ') };   // 줄 이름 칸이 좁아 세 가지만 — 전체는 마우스를 올리면
  }

  function ticksFor(t0, t1, width) {
    const spanH = (t1 - t0) / 36e5;
    const steps = [1, 2, 3, 6, 12, 24];
    const step = steps.find(s => (spanH / s) * 64 <= width) || 24;
    const out = [];
    for (let d = Math.floor(+t0 / 36e5) * 36e5; d <= t1; d += 36e5) if (d >= t0 && K(d).h % step === 0) out.push(new Date(d));   // KST 정시 = UTC 정시(+9 고정)
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
      'aria-label': `에이전트 활동 기록, 최근 ${data.hours}시간` }, wrap);

    // 날짜 띠(하루씩 번갈아) + 밤 시간(00~07) 음영
    let day = kstDay0(t0);
    let alt = 0;
    while (day < t1) {
      const n = new Date(+day + 864e5);
      const a = Math.max(x(day), LABEL_W), b = Math.min(x(n), width - PAD_R);
      if (b > a) {
        if (alt % 2) svgEl('rect', { x: a, y: AXIS_H, width: b - a, height: height - AXIS_H, class: 'dayband' }, svg);
        const nightEnd = new Date(+day + 7 * 36e5);
        const na = Math.max(x(day), LABEL_W), nb = Math.min(x(nightEnd), width - PAD_R);
        if (nb > na) svgEl('rect', { x: na, y: AXIS_H, width: nb - na, height: height - AXIS_H, class: 'night' }, svg);
        if (x(day) >= LABEL_W) svgEl('text', { x: x(day) + 4, y: 12, class: 'axis-date' }, svg).textContent = `${md(day)} (${'일월화수목금토'[K(day).dow]})`;
      }
      day = n; alt++;
    }
    // 시각 눈금
    for (const d of ticksFor(t0, t1, plotW)) {
      const px = x(d);
      svgEl('line', { x1: px, x2: px, y1: AXIS_H - 6, y2: height, class: 'grid' }, svg);
      if (px < x(now) - 18 || px > x(now) + 78)   // '지금 HH:MM' 글자와 겹치는 눈금 글자는 뺀다
        svgEl('text', { x: px, y: AXIS_H - 10, class: 'axis', 'text-anchor': 'middle' }, svg).textContent = `${K(d).h}시`;
    }

    let y = AXIS_H;
    const tip = $('act-tip');
    // 그림이 옆으로 밀려 있어도 마우스 곁에(스크롤만큼 더함)
    const showTip = (ev, html) => {
      tip.textContent = ''; tip.append(html); tip.hidden = false;
      const r = wrap.getBoundingClientRect(), tw = tip.offsetWidth || 320;
      let left = ev.clientX - r.left + 14, top = ev.clientY - r.top + 14;
      if (left + tw > r.width - 4) left = ev.clientX - r.left - tw - 14;
      tip.style.left = `${Math.max(4, left) + wrap.scrollLeft}px`; tip.style.top = `${top + wrap.scrollTop}px`;
    };
    const hideTip = () => { tip.hidden = true; };
    const bind = (node, contentFn, pinFn) => {
      const pin = () => { pinned = pinFn(); showPinned(); const card = $('act-detail')?.closest('.card'); if (card) card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); };
      node.addEventListener('mousemove', (e) => showTip(e, contentFn()));
      node.addEventListener('mouseleave', hideTip);
      node.addEventListener('click', pin);
      node.setAttribute('tabindex', '0');
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pin(); } });
    };

    for (const g of groups) {
      svgEl('text', { x: 12, y: y + 17, class: 'group' }, svg).textContent = g;
      svgEl('line', { x1: 12, x2: width - PAD_R, y1: y + GROUP_H - 2, y2: y + GROUP_H - 2, class: 'groupline' }, svg);
      y += GROUP_H;
      for (const ln of lanes.filter(l => l.group === g)) {
        const cy = y + 16, my = y + 34, name = laneName(ln.label);
        // 줄 이름(분야 색 띠 + 이름 + 실행 방식 + 요약)
        svgEl('rect', { x: 12, y: y + 6, width: 4, height: LANE_H - 12, rx: 2, fill: ln.color }, svg);
        svgEl('text', { x: 24, y: y + 19, class: 'lane' }, svg).textContent = name;
        const sub = laneSub(ln);
        const subEl = svgEl('text', { x: 24, y: y + 35, class: 'lane-sub' }, svg);
        subEl.textContent = sub.short;
        svgEl('title', {}, subEl).textContent = sub.full;   // 줄이 좁아 잘리면 마우스를 올려 전체
        svgEl('line', { x1: LABEL_W, x2: width - PAD_R, y1: y + LANE_H, y2: y + LANE_H, class: 'laneline' }, svg);

        // 지난 예정 시각(작은 눈금) — 회차가 빠졌으면 눈금만 남는다
        for (const s of ln.slots || []) {
          const px = x(T(s));
          svgEl('line', { x1: px, x2: px, y1: cy - 10, y2: cy - 6, class: 'slot' }, svg);
        }
        // 앞으로 예정
        for (const p of ln.planned || []) {
          const px = x(T(p)), w = Math.max(8, ((ln.stats.avg_secs || 600) * 1000 / (t1 - t0)) * plotW);
          const r = svgEl('rect', { x: px, y: cy - 7, width: w, height: 14, rx: 4, class: 'planned' }, svg);
          bind(r, () => tipBox(`${name} 예정`, [`${md(T(p))} ${hm(T(p))} 예정`, ln.runner && `실행 ${runner(ln.runner)}`]),
            () => ({ lane: ln, title: `${name} · 예정 회차`, rows: [['시각', `${md(T(p))} ${hm(T(p))}`], ['실행', runner(ln.runner) || '—']] }));
        }
        // 회차 막대
        for (const s of ln.segments) {
          if (s.status === 'skip') {   // 문지기가 건너뛴 회차: 막대 대신 속 빈 동그라미(정상 막대에 가리지 않게 위에)
            const c = svgEl('circle', { cx: x(T(s.start)), cy: cy + 11, r: 4.5, class: 'skipdot' }, svg);
            const rows = [`${md(T(s.start))} ${hm(T(s.start))} · 건너뜀`, plain(s.detail) || '할 일이 없어 에이전트를 띄우지 않았어요'];
            bind(c, () => tipBox(name, rows), () => ({ lane: ln, title: `${name} · 건너뛴 회차`, rows: [['시각', rows[0]], ['이유', rows[1]]] }));
            continue;
          }
          const a = Math.max(x(T(s.start)), LABEL_W);
          const b = Math.min(x(s.end ? T(s.end) : now), width - PAD_R);
          const w = Math.max(b - a, 6);
          const meta = STATUS[s.status] || STATUS.ok;
          const r = svgEl('rect', { x: a, y: cy - 7, width: w, height: 14, rx: 4, class: 'bar ' + meta.cls }, svg);
          if (w > 22) svgEl('text', { x: a + 6, y: cy + 4, class: 'bar-icon' }, svg).textContent = meta.icon;
          for (const stp of s.steps || []) svgEl('circle', { cx: x(T(stp.at)), cy, r: 2, class: 'step' }, svg);
          const title = plain(s.title);
          const rows = [`${md(T(s.start))} ${hm(T(s.start))} → ${s.end ? hm(T(s.end)) : '진행 중'} · ${dur(s.secs)}`,
            `${meta.label}${s.runner ? ' · ' + runner(s.runner) : ''}`, title,
            (s.steps || []).length ? `단계: ${s.steps.map(z => z.step).join(' → ')}` : '', plain(s.detail)];
          bind(r, () => tipBox(name, rows), () => ({ lane: ln, title: `${name} · ${title}`, rows: [
            ['시간', rows[0]], ['상태', meta.label], ['실행', runner(s.runner) || (ln.kind === 'claude-desktop' ? '데스크톱 앱' : '—')],
            ['단계', (s.steps || []).map(z => `${hm(T(z.at))} ${z.step}`).join('\n') || '—'], ['마지막 답', plain(s.detail) || '—']] }));
        }
        // 한 일(점) — 묶어서. 묶음 수 글자는 옆 점과 겹치면 빼고(마우스를 올리면 수가 보임)
        const cls = [...cluster(ln.markers.filter(m => m.kind === 'write' || m.kind === 'ops'), (d) => x(d), 16),
                     ...cluster(ln.markers.filter(m => m.kind !== 'write' && m.kind !== 'ops'), (d) => x(d), 8)];
        const centers = cls.map(c => (c.px0 + c.px1) / 2).sort((p, q) => p - q);
        const taken = [];
        for (const c of cls) {
          const px = (c.px0 + c.px1) / 2, n = c.items.length, lvl = worstLevel(c.items);
          let node;
          if (c.kind === 'notify') {
            const cl = (SEV[lvl] || SEV.info)[1];
            node = svgEl('circle', { cx: px, cy: my, r: n > 1 ? 6 : 5, class: 'mk ' + cl }, svg);
          } else if (c.kind === 'log') {
            node = svgEl('rect', { x: px - 5, y: my - 5, width: 10, height: 10, rx: 2, class: 'mk mk-log' }, svg);
          } else if (c.kind === 'hub') {   // 이벤트 허브 사건: 마름모(실패 빨강·할 일 주황·정상 초록)
            const cl = lvl === 'fail' ? 'mk-crit' : lvl === 'todo' ? 'mk-high' : lvl === 'info' ? 'mk-info' : 'mk-hubok';
            node = svgEl('path', { d: `M${px} ${my - 6} L${px + 6} ${my} L${px} ${my + 6} L${px - 6} ${my} Z`, class: 'mk ' + cl }, svg);
          } else if (c.kind === 'ops') {
            node = svgEl('path', { d: `M${px} ${my - 6} L${px + 6} ${my + 5} L${px - 6} ${my + 5} Z`, class: 'mk mk-ops' }, svg);
          } else {
            node = svgEl('rect', { x: px - 2, y: my - 7, width: 4, height: 14, rx: 2, class: 'mk mk-write' }, svg);
          }
          // 묶음 안 실패는 따로: 작은 빨간 점 + 실패 수(묶음 전체를 빨갛게 칠하지 않는다)
          const fails = c.items.filter(m => m.level === 'fail').length;
          if (fails) svgEl('circle', { cx: px, cy: my - 9, r: 3, class: 'mk-failpip' }, svg);
          if (n > 1) {
            const label = fails ? `${n}(실패 ${fails})` : String(n), x0 = px + 8, x1 = x0 + label.length * 6.6;
            const hit = centers.some(q => q !== px && q > px + 2 && q - 7 < x1) || taken.some(([a, b]) => x0 < b + 2 && a < x1 + 2) || x1 > width - PAD_R;
            if (!hit) { svgEl('text', { x: x0, y: my + 4, class: 'count' }, svg).textContent = label; taken.push([x0, x1]); }
          }
          const first = T(c.items[0].at), last = T(c.items[n - 1].at);
          const head = `${KIND[c.kind]} ${n > 1 ? n + '건 · ' : ''}${hm(first)}${n > 1 ? '–' + hm(last) : ''}`;
          bind(node, () => tipBox(`${name} · ${head}`, c.items.slice(-6).reverse().map(m => `${hm(T(m.at))} ${m.level && SEV[m.level] ? '[' + SEV[m.level][0] + '] ' : ''}${plain(m.title)}`)
            .concat(n > 6 ? [`외 ${n - 6}건 더 · 누르면 모두 보여요`] : [])),
            () => ({ lane: ln, title: `${name} · ${head}`, items: c.items }));
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
    if (!pinned) { box.append(h('p', 'muted small', '그림의 막대나 점을 누르면 여기에 자세히 보여요.')); return; }
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
        li.append(h('span', 'name', plain(m.title)));
        if (m.detail) { const d = h('details'); d.append(h('summary', null, '내용'), h('pre', null, m.detail)); li.append(d); }
        if (m.ref) { const a = h('a', 'small', '알림 기록에서 보기'); a.href = '#ev-' + m.ref; li.append(a); }
        ul.append(li);
      }
      box.append(ul);
    }
  }

  function renderTable() {
    const t = $('act-table'); t.textContent = '';
    const rows = [];
    for (const ln of data.lanes) {
      const name = laneName(ln.label);
      for (const s of ln.segments) rows.push([s.start, name, '회차', `${(STATUS[s.status] || {}).label || s.status} · ${dur(s.secs)}${s.runner ? ' · ' + runner(s.runner) : ''}`, plain(s.title)]);
      for (const m of ln.markers) rows.push([m.at, name, KIND[m.kind], m.level && SEV[m.level] ? SEV[m.level][0] : LEVEL[m.level] || (window.koLabel ? window.koLabel(m.level || '') : (m.level || '')), plain(m.title)]);
    }
    rows.sort((a, b) => b[0].localeCompare(a[0]));
    const table = h('table');
    const thead = h('thead'); const tr = h('tr');
    for (const c of ['시각', '업무', '종류', '상태', '내용']) tr.append(h('th', null, c));
    thead.append(tr); table.append(thead);
    const tb = h('tbody');
    for (const r of rows.slice(0, 400)) {
      const row = h('tr');
      row.append(h('td', 'small', `${md(T(r[0]))} ${hm(T(r[0]))}`), h('td', null, r[1]), h('td', null, r[2]), h('td', 'small', r[3]), h('td', null, r[4]));
      tb.append(row);
    }
    table.append(tb); t.append(table);
  }

  // 2026-11-06: 503이면 '{}'를 자료로 삼아 TypeError 글이 그대로 보이고 마지막 정상 그림도 지워졌음 → 응답 확인, 실패하면 이전 그림 유지 + 안내 한 줄.
  // 화면이 숨겨진 동안에도 1분마다 7일 치까지 읽던 것 → 보일 때만 읽고, 보이게 되면 그때 폭으로 다시 그림(숨김 상태에선 폭 0이라 640px로 그려졌음).
  let seq = 0;
  async function load() {
    controls();
    const my = ++seq;
    try {
      const r = await (window.barunFetch || fetch)(`/api/timeline?hours=${hours}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      const j = await r.json(); if (my !== seq) return;
      if (!j || !Array.isArray(j.lanes)) throw new Error('받은 자료를 알아보지 못함');
      data = j;
      render(); showPinned();
    } catch (e) {
      if (my !== seq || e.message === '로그인 필요') return;
      const wrap = $('act-chart'), tipNode = $('act-tip');
      const note = h('p', 'muted small', `활동 기록을 읽지 못했어요(${e.message}). 잠시 뒤 다시 읽어요.` + (data ? ' 아래는 마지막으로 읽은 그림이에요.' : ''));
      note.className = 'muted small act-err';
      if (!data) { wrap.textContent = ''; wrap.append(tipNode, note); } else { wrap.querySelector('.act-err')?.remove(); wrap.prepend(note); }
    }
  }
  const visible = () => { const p = $('p-activity'); return !document.hidden && (!p || !p.hidden); };

  window.addEventListener('resize', () => { clearTimeout(window.__actRs); window.__actRs = setTimeout(() => { if (visible()) render(); }, 150); });
  NARROW.addEventListener('change', () => { tableOn = NARROW.matches; controls(); if (visible()) render(); });
  document.addEventListener('barun:page', (e) => { if (e.detail === 'activity') load(); });
  window.barunReloadTimeline = load;
  load();
  setInterval(() => { if (visible()) load(); }, 60000);
})();
