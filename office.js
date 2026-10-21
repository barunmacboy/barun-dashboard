// 🏢 사무실 — 에이전트(직원) 한 명 = 도트 캐릭터 한 명. 지금 무엇을 하는지 / 할 건지 / 했는지 (2026-10-21 사용자:
// "현황판에 도트 그래픽으로 실제 일하는 에이전트 캐릭터들을 사람처럼 모아서 각각 무슨 일을 하고있는지/할건지/했는지 편하게 볼 수 있게").
// 자료는 /api/state의 team(notify/team.py data() — 디스코드 #상황판 '직원 현황'과 같은 것) + jobs[].runs(실행기 회차) + tasks(디스코드 작업).
// 그림은 48×36 도트 캔버스를 4배로 키워 그린다(image-rendering: pixelated). 글자는 캔버스가 아니라 HTML(선명·복사 가능).
// 상태: 🟢 일하는 중 = 타자 치는 손·화면 깜빡임 · 🟡 할 일 있음 = 노란 ! · 🔴 막힘 = 빨간 ! 와 땀 · ⚪ 대기 = 눈 감고 Zzz.
// 움직임 줄이기 설정(prefers-reduced-motion)이면 멈춘 그림 한 장만.
(function () {
  const W = 48, H = 36, SC = 4;
  // 자리 배치는 고정(정렬하면 자리가 바뀌어 찾기 어려움) — 지휘 먼저, 그다음 업무 순서
  const SEATS = ['commander', 'orders', 'mail', 'pricing', 'inquiry', 'close', 'sourcing', 'improve', 'infra'];
  // 직원마다 머리·옷·소품
  const LOOK = {
    commander: { hair: '#2b2118', shirt: '#2f3e5c', prop: 'tie' },
    orders:    { hair: '#5a3a22', shirt: '#c8642c', prop: 'box', hat: '#2a5fae' },
    mail:      { hair: '#1c1c22', shirt: '#3d8c6a', prop: 'mail' },
    pricing:   { hair: '#8a5a2b', shirt: '#b8902a', prop: 'coin' },
    inquiry:   { hair: '#3a2a4a', shirt: '#7a4fb0', prop: 'headset' },
    close:     { hair: '#6b6b6b', shirt: '#4a6fa8', prop: 'chart', glasses: true },
    sourcing:  { hair: '#a0522d', shirt: '#2d8a8a', prop: 'magnifier', glasses: true },
    improve:   { hair: '#2b2118', shirt: '#5b6b7a', prop: 'wrench', hat: '#e2b100' },
    infra:     { hair: '#141414', shirt: '#333a44', prop: 'rack' },
  };
  const SKIN = '#f1c7a0', SKIN2 = '#d9a77f', EYE = '#1d1d24';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const darkQ = window.matchMedia && matchMedia('(prefers-color-scheme: dark)');
  const PAL = () => (darkQ && darkQ.matches
    ? { wall: '#2a2f3a', wall2: '#252a34', base: '#1b1f27', floor: '#4a3c2c', floor2: '#433626', desk: '#6d4c30', desk2: '#57391f', chair: '#1e2129', lid: '#8b93a3', lid2: '#6c7484', win: '#33415a', win2: '#1b1f27' }
    : { wall: '#ece6da', wall2: '#e2dacb', base: '#b9ad97', floor: '#c9a877', floor2: '#bb996a', desk: '#8b5e3c', desk2: '#6f4729', chair: '#3b3f4a', lid: '#b9c0cc', lid2: '#9aa2b0', win: '#bfe0f5', win2: '#ffffff' });

  // 16×14 상반신(H 머리 S 피부 s 그늘 E 눈 M 입 B 옷 b 옷 그늘)
  const BODY = [
    '......HHHH......',
    '....HHHHHHHH....',
    '...HHHHHHHHHH...',
    '...HSSSSSSSSH...',
    '...SSESSSSESS...',
    '...SSSSSSSSSS...',
    '....SSSMMSSS....',
    '.....SSSSSS.....',
    '......ssss......',
    '...BBBBBBBBBB...',
    '..BBBBBBBBBBBB..',
    '.BBBBBBBBBBBBBB.',
    '.BbBBBBBBBBBBbB.',
    '.BbBBBBBBBBBBbB.',
  ];
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
  };
  const kindOf = (st) => (st || '').startsWith('🟢') ? 'busy' : (st || '').startsWith('🔴') ? 'blocked' : (st || '').startsWith('🟡') ? 'todo' : 'idle';

  function draw(cv, look, kind, f) {
    const g = cv.getContext('2d'); const P = PAL();
    const px = (x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    // 벽·창문·바닥
    px(0, 0, P.wall, W, 22); for (let x = 0; x < W; x += 6) px(x, 0, P.wall2, 1, 22);
    px(3, 3, P.win2, 10, 9); px(4, 4, P.win, 8, 7); px(8, 4, P.win2, 1, 7); px(4, 7, P.win2, 8, 1);
    px(0, 22, P.base, W, 1);
    for (let y = 23; y < H; y++) px(0, y, (y % 3 ? P.floor : P.floor2), W, 1);
    for (let x = 0; x < W; x += 8) px(x + ((x / 8) % 2) * 4, 23, P.floor2, 1, H - 23);
    // 의자 등받이
    px(14, 10, P.chair, 20, 10); px(13, 11, P.chair, 1, 9); px(34, 11, P.chair, 1, 9);
    // 사람(눕듯 쉬면 한 칸 뒤로 기댐)
    const oy = 6 + (kind === 'idle' ? 1 : 0) + (kind === 'busy' && !reduce && f % 8 < 1 ? -0 : 0);
    const ox = 16;
    const C = { H: look.hair, S: SKIN, s: SKIN2, E: EYE, M: '#b5524a', B: look.shirt, b: shade(look.shirt, 0.78) };
    BODY.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      let c = C[ch];
      if (ch === 'E' && kind === 'idle') { c = SKIN; px(ox + x, oy + y + 1, EYE); }     // 감은 눈은 한 줄 아래 가는 선
      if (ch === 'E' && kind === 'blocked') px(ox + x, oy + y - 1, EYE);               // 놀라서 큰 눈
      if (ch === 'M' && kind === 'idle') c = SKIN2;
      px(ox + x, oy + y, c);
    }));
    if (look.glasses) { px(ox + 4, oy + 4, '#222', 3, 1); px(ox + 9, oy + 4, '#222', 3, 1); px(ox + 7, oy + 4, '#222', 2, 1); px(ox + 4, oy + 3, '#222', 1, 1); }
    if (look.hat) { px(ox + 3, oy - 1, look.hat, 10, 3); px(ox + 2, oy + 2, shade(look.hat, 0.8), 12, 1); }
    if (look.prop === 'headset') { px(ox + 2, oy + 1, '#222', 1, 5); px(ox + 13, oy + 1, '#222', 1, 5); px(ox + 3, oy - 0, '#222', 10, 1); px(ox + 12, oy + 6, '#222', 1, 1); px(ox + 10, oy + 7, '#222', 2, 1); }
    if (look.prop === 'tie') { px(ox + 7, oy + 9, '#c0392b', 2, 1); px(ox + 7, oy + 10, '#a93226', 2, 3); px(ox + 6, oy + 9, '#fff', 1, 1); px(ox + 9, oy + 9, '#fff', 1, 1); }
    // 책상
    px(8, 20, P.desk, 32, 2); px(8, 22, P.desk2, 32, 1); px(9, 23, P.desk2, 2, 9); px(37, 23, P.desk2, 2, 9);
    // 노트북 뒷면(일할 때 가장자리가 깜빡)
    px(18, 14, P.lid2, 12, 6); px(19, 15, P.lid, 10, 4); px(23, 16, '#fff', 2, 2);
    if (kind === 'busy') px(18, 14, (reduce || f % 4 < 2) ? '#7fd3ff' : '#4fa8e0', 12, 1);
    if (kind === 'blocked') px(18, 14, (reduce || f % 6 < 3) ? '#ff6b5b' : '#c0392b', 12, 1);
    // 손: 일하면 번갈아 타자
    const up = kind === 'busy' && !reduce ? f % 2 : 0;
    px(16, 19 - up, SKIN, 2, 1); px(30, 19 - (kind === 'busy' && !reduce ? 1 - (f % 2) : 0), SKIN, 2, 1);
    // 책상 소품
    const p = look.prop;
    if (p === 'box') { px(32, 16, '#c9935a', 6, 4); px(32, 16, '#a8743f', 6, 1); px(34, 16, '#e8d3a8', 2, 4); }
    if (p === 'mail') { px(32, 17, '#fff', 6, 3); px(32, 17, '#cfd6e0', 6, 1); px(34, 18, '#c0392b', 2, 1); px(31, 16, '#fff', 6, 1); }
    if (p === 'coin') { [0, 1, 2].forEach((i) => { px(33, 19 - i, '#e2b100', 4, 1); px(33, 19 - i, '#b38900', 1, 1); }); px(36, 15, '#ffd84a', 2, 2); }
    if (p === 'chart') { px(32, 14, '#fff', 6, 6); px(33, 18, '#2a78d6', 1, 1); px(34, 17, '#2a78d6', 1, 2); px(35, 16, '#2a78d6', 1, 3); px(36, 15, '#1f8a4c', 1, 4); }
    if (p === 'magnifier') { px(33, 16, '#555', 3, 1); px(33, 18, '#555', 3, 1); px(33, 17, '#555', 1, 1); px(35, 17, '#555', 1, 1); px(34, 17, '#bfe0f5', 1, 1); px(36, 19, '#7a4a20', 2, 1); }
    if (p === 'wrench') { px(32, 19, '#8a94a3', 6, 1); px(31, 18, '#8a94a3', 2, 1); px(31, 20, '#8a94a3', 2, 1); }
    if (p === 'tie') { px(32, 17, '#fff', 5, 3); px(33, 18, '#6b7385', 3, 1); px(36, 14, '#c0392b', 1, 3); px(37, 14, '#c0392b', 2, 2); px(36, 14, '#555', 1, 6); }
    if (p === 'headset') { px(32, 18, '#2f3e5c', 5, 2); px(33, 17, '#2f3e5c', 3, 1); }
    if (p === 'rack') {   // 서버 선반 + 깜빡이는 불
      px(41, 4, '#2a2e36', 6, 27); for (let y = 6; y < 29; y += 4) { px(42, y, '#3d434e', 4, 3); px(45, y + 1, ((f + y) % 5 < 3 || reduce) ? '#3ddc84' : '#1f6b44', 1, 1); }
    }
    // 머리 위 표시
    const bob = reduce ? 0 : (f % 6 < 3 ? 0 : 1);
    if (kind === 'todo' || kind === 'blocked') {
      const c = kind === 'todo' ? '#e2a400' : '#e0402f';
      px(23, 0 + bob, c, 2, 3); px(23, 4 + bob, c, 2, 1);
    }
    if (kind === 'blocked') { px(14, 8, '#7fc4ff', 1, 2); px(13, 9, '#7fc4ff', 1, 1); }
    if (kind === 'idle') {
      const z = reduce ? 0 : f % 12;
      const zz = (x, y) => { px(x, y, '#8a93a6', 3, 1); px(x + 1, y + 1, '#8a93a6', 1, 1); px(x, y + 2, '#8a93a6', 3, 1); };
      zz(33, 5 - Math.floor(z / 4)); if (z > 5) zz(37, 2);
    }
  }

  // ── 글자 정리 ──────────────────────────────────────────────────────────────
  const clip = (t, n) => { t = String(t || '').replace(/<@[!&]?\d+>/g, '@').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const hm = (iso) => iso ? iso.slice(11, 16) : '';
  const day = (iso, nowIso) => !iso ? '' : (iso.slice(0, 10) === (nowIso || '').slice(0, 10) ? hm(iso) : iso.slice(5, 10).replace('-', '/') + ' ' + hm(iso));
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  // 그 직원이 '했던 일': 실행기 회차(그 분야 업무) + 끝난 디스코드 작업 — 최신 먼저
  function history(m, s) {
    const out = [];
    for (const j of s.jobs || []) {
      if (j.domain !== m.domain || !j.runs) continue;
      const nm = (j.desc || j.id).split(' — ')[0];
      j.runs.forEach((r, i) => {
        if (!r.end) return;
        const st = r.skip ? '➖' : (r.rc === 0 ? '✅' : '❌');
        const sum = r.skip ? '할 일 없어 건너뜀' + (r.why ? ' — ' + r.why : '') : (i === 0 && r.summary ? r.summary.split('\n').find((x) => x.trim().replace(/^[-#•\s]+/, '')) || '' : (r.rc === 0 ? `정상(${r.secs}초)` : `실패 rc=${r.rc}`));
        out.push({ at: r.start, text: `${st} ${nm} — ${clip(sum.replace(/^[-#•\s]+/, ''), 140)}` });
      });
    }
    for (const t of s.tasks || []) {
      const mine = m.domain === 'commander' || (t.domains || []).includes(m.domain);
      if (mine && t.state === 'done') out.push({ at: t.last, text: `💬 ${clip(t.title, 50)} — ${clip(t.summary, 110)}` });
    }
    return out.sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 8);
  }
  function doing(m, s) {
    const out = [];
    if (m.now) out.push(clip(m.now, 200));
    for (const t of s.tasks || []) {
      const mine = m.domain === 'commander' ? true : (t.domains || []).includes(m.domain);
      if (mine && t.state === 'run' && !(m.now || '').includes(clip(t.title, 12).replace('…', ''))) out.push(`💬 ${clip(t.title, 60)}(${t.stage || '진행'})`);
    }
    return out;
  }
  function upcoming(m, s) {
    const out = [];
    const nx = m.next || {};
    if (nx.at) out.push(`⏰ ${day(nx.at, s.now)} ${nx.job || ''}`);
    else if (nx.job) out.push(`⏰ ${nx.job}`);
    if (m.wake) out.push(`📡 ${m.wake}이면 바로 깨어남`);
    if (m.cards) out.push(`🟠 #할-일 ${m.cards}건${m.urgent ? `(긴급 ${m.urgent})` : ''}${m.top_card ? ' — ' + clip(m.top_card, 70) : ''}`);
    for (const t of s.tasks || []) {
      const mine = m.domain === 'commander' || (t.domains || []).includes(m.domain);
      if (mine && t.state === 'wait') out.push(`✋ 승인 기다림: ${clip(t.title, 60)}`);
    }
    if (m.debt) out.push(`🧹 기술부채 ${m.debt}건 — ${clip((m.debt_top || {}).text, 60)}`);
    return out;
  }

  // ── 그리기 ────────────────────────────────────────────────────────────────
  let frame = 0, timer = null, sel = null, last = null;
  const seats = new Map();   // domain → {cv, look, kind}
  const STATE_TXT = { busy: '일하는 중', todo: '할 일 있음', blocked: '막힘', idle: '쉬는 중' };

  function renderDetail() {
    const box = document.getElementById('office-detail'); if (!box || !last) return;
    box.textContent = '';
    const m = (last.team || []).find((x) => x.domain === sel);
    if (!m) { box.append(E('div', 'muted small', '캐릭터를 누르면 그 직원이 한 일·하는 일·할 일을 자세히 보여 줘요.')); return; }
    box.append(E('div', 'od-h', `${m.name} — ${m.role || ''}`));
    const col = (title, items, empty) => {
      const c = E('div', 'od-col'); c.append(E('div', 'od-t', title));
      const ul = E('ul'); (items.length ? items : [empty]).forEach((x) => {
        const li = E('li', items.length ? '' : 'muted');
        if (x && typeof x === 'object') { li.append(E('span', 'muted', day(x.at, last.now) + ' '), document.createTextNode(x.text)); } else li.textContent = x;
        ul.append(li);
      });
      c.append(ul); return c;
    };
    const g = E('div', 'od-grid');
    g.append(col('✓ 했던 일', history(m, last), '최근 기록 없음'), col('▶ 하는 일', doing(m, last), '지금은 쉬는 중'), col('⏭ 할 일', upcoming(m, last), '정해진 다음 일 없음'));
    box.append(g);
    if (m.top_card_link) { const a = E('a', 'small', '디스코드 #할-일에서 열기 ↗'); a.href = m.top_card_link; a.target = '_blank'; a.rel = 'noopener'; box.append(a); }
  }

  function render(s) {
    last = s;
    const root = document.getElementById('office'); if (!root) return;
    const byDom = new Map((s.team || []).map((m) => [m.domain, m]));
    const order = [...SEATS.filter((d) => byDom.has(d)), ...[...byDom.keys()].filter((d) => !SEATS.includes(d))];
    if (root.dataset.seats !== order.join(',')) { root.textContent = ''; seats.clear(); root.dataset.seats = order.join(','); }
    for (const d of order) {
      const m = byDom.get(d); const kind = kindOf(m.state);
      let st = seats.get(d);
      if (!st) {
        const el = E('button', 'seat'); el.type = 'button';
        const cv = E('canvas'); cv.width = W; cv.height = H; cv.setAttribute('aria-hidden', 'true');
        const nm = E('div', 'seat-nm'); const say = E('div', 'seat-say'); const sub = E('div', 'seat-sub');
        el.append(cv, nm, say, sub); root.append(el);
        el.onclick = () => { sel = sel === d ? null : d; for (const [k, v] of seats) v.el.classList.toggle('sel', k === sel); renderDetail(); };
        st = { el, cv, nm, say, sub, look: LOOK[d] || { hair: '#333', shirt: '#777' } };
        seats.set(d, st);
      }
      st.kind = kind;
      st.el.className = `seat k-${kind}${sel === d ? ' sel' : ''}`;
      st.nm.textContent = ''; st.nm.append(E('b', null, m.name), E('span', 'seat-st', ` ${STATE_TXT[kind]}`));
      const L = m.last || {};
      st.say.textContent = m.now ? `▶ ${clip(m.now, 70)}` : (kind === 'blocked' || kind === 'todo') && m.top_card ? `! ${clip(m.top_card, 70)}` : 'Zzz… 기다리는 중';
      const nx = m.next || {};
      st.sub.textContent = '';
      const h0 = history(m, s)[0];
      st.sub.append(E('div', null, L.at ? `✓ ${day(L.at, s.now)} ${L.kind === 'skip' ? '할 일 없어 건너뜀' : clip(L.text, 60)}` : h0 ? `✓ ${day(h0.at, s.now)} ${clip(h0.text.slice(2), 60)}` : '✓ 최근 기록 없음'),
                    E('div', null, `⏭ ${nx.at ? day(nx.at, s.now) + ' ' + (nx.job || '') : (nx.job || m.wake || '정해진 일 없음')}${m.cards ? ` · 할 일 ${m.cards}` : ''}`));
      st.el.setAttribute('aria-label', `${m.name} ${STATE_TXT[kind]}. ${st.say.textContent}`);
      draw(st.cv, st.look, kind, frame);
    }
    const busy = [...seats.values()].filter((v) => v.kind === 'busy').length;
    const cnt = document.getElementById('office-count');
    if (cnt) cnt.textContent = `일하는 중 ${busy} · 할 일 있음 ${[...seats.values()].filter((v) => v.kind === 'todo').length} · 막힘 ${[...seats.values()].filter((v) => v.kind === 'blocked').length} · 쉬는 중 ${[...seats.values()].filter((v) => v.kind === 'idle').length}`;
    renderDetail();
    if (!timer && !reduce) timer = setInterval(() => { frame++; if (document.hidden) return; for (const v of seats.values()) draw(v.cv, v.look, v.kind, frame); }, 260);
  }
  if (darkQ && darkQ.addEventListener) darkQ.addEventListener('change', () => { for (const v of seats.values()) draw(v.cv, v.look, v.kind, frame); });
  window.barunOffice = render;
})();
