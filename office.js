// 🏢 사무실 — 에이전트(직원) 아홉 명이 한 사무실에 모여 앉아 일한다 (2026-10-21 사용자: "현황판 페이지의 캐릭터를 한 사무실에 넣어야지").
// 자료는 /api/state의 team(notify/team.py data() — 디스코드 #상황판 '직원 현황'과 같은 것) + jobs[].runs(실행기 회차) + tasks(디스코드 작업).
// 그림: 도트 캔버스 한 장(W×H)을 화면 폭에 맞게 키워 그린다(image-rendering: pixelated). 이름표·말풍선은 캔버스 위 HTML(선명·복사·스크린리더).
// 상태: 🟢 일하는 중 = 타자 치는 손·화면 빛 · 🟡 할 일 있음 = 노란 ! · 🔴 막힘 = 빨간 ! 와 땀 · ⚪ 대기 = 눈 감고 Zzz.
// 말풍선은 일하는 중·할 일·막힘인 직원만(쉬는 직원까지 띄우면 읽을 것이 너무 많음). 좁은 화면에서는 말풍선 대신 아래 직원 목록으로.
// 움직임 줄이기 설정(prefers-reduced-motion)이면 멈춘 그림 한 장만.
(function () {
  // 자리 배치는 고정(상태로 정렬하면 자리가 바뀌어 찾기 어려움) — 뒷줄 가운데가 지휘, 서버 선반 옆이 인프라
  const SEATS = ['improve', 'commander', 'infra', 'orders', 'mail', 'pricing', 'inquiry', 'close', 'sourcing'];
  const COLS = [44, 120, 196], WALL = 46, ROW0 = 44, ROW_H = 56, W = 240;   // 줄 간격은 말풍선(2줄)이 뒷줄 이름표를 가리지 않을 만큼
  const LOOK = {
    commander: { hair: '#2b2118', shirt: '#2f3e5c', prop: 'tie', boss: true },
    orders:    { hair: '#5a3a22', shirt: '#e2703a', prop: 'box', hat: '#3182f6' },
    mail:      { hair: '#1c1c22', shirt: '#3d9c74', prop: 'mail' },
    pricing:   { hair: '#8a5a2b', shirt: '#d3a52b', prop: 'coin' },
    inquiry:   { hair: '#3a2a4a', shirt: '#8358c4', prop: 'headset' },
    close:     { hair: '#6b6b6b', shirt: '#4a78c0', prop: 'chart', glasses: true },
    sourcing:  { hair: '#a0522d', shirt: '#2d9a9a', prop: 'magnifier', glasses: true },
    improve:   { hair: '#2b2118', shirt: '#5b6b7a', prop: 'wrench', hat: '#f5b800' },
    infra:     { hair: '#141414', shirt: '#38404c', prop: 'server' },
  };
  const SKIN = '#f1c7a0', SKIN2 = '#d9a77f', EYE = '#1d1d24';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const darkQ = window.matchMedia && matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme !== 'light' && darkQ && darkQ.matches);
  const PAL = () => (isDark()
    ? { wall: '#2a2d36', wall2: '#262932', base: '#3a3e4a', floor: '#3b3329', floor2: '#352d24', seam: '#2c251d', desk: '#7a573a', desk2: '#5e4029', chair: '#17191f', lid: '#8b93a3', lid2: '#6c7484', frame: '#4a4f5c', board: '#d8dde4', pot: '#8a5a3c', leaf: '#3f9a63', leaf2: '#2f7a4c', rack: '#1a1d23', rack2: '#2b3039', sel: 'rgba(69,147,252,.45)', rug: '#2f3647' }
    : { wall: '#f3efe7', wall2: '#ebe5da', base: '#cfc4b0', floor: '#e3cfa9', floor2: '#dcc59c', seam: '#cdb489', desk: '#9a6a44', desk2: '#7b5233', chair: '#3b3f4a', lid: '#c2c8d2', lid2: '#a3abb8', frame: '#b7aea0', board: '#ffffff', pot: '#c57a4a', leaf: '#4caf72', leaf2: '#378a57', rack: '#2a2e36', rack2: '#3d434e', sel: 'rgba(49,130,246,.35)', rug: '#dfe7f3' });

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
  const rowsFor = (n) => Math.max(3, Math.ceil(n / 3));
  const heightFor = (n) => ROW0 + rowsFor(n) * ROW_H;
  const seatPos = (i) => ({ cx: COLS[i % 3], oy: ROW0 + Math.floor(i / 3) * ROW_H });

  // ── 방(벽·창·칠판·시계·화분·서버 선반·바닥) ─────────────────────────────────
  function drawRoom(g, H, f, hour) {
    const P = PAL();
    const px = (x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    px(0, 0, P.wall, W, WALL); for (let x = 0; x < W; x += 8) px(x, 0, P.wall2, 1, WALL);
    px(0, WALL - 2, P.base, W, 2);
    // 바닥 널(5줄마다 이음선, 세로 이음은 줄마다 엇갈리게)
    for (let y = WALL, r = 0; y < H; y += 6, r++) {
      px(0, y, r % 2 ? P.floor : P.floor2, W, 6); px(0, y + 5, P.seam, W, 1);
      for (let x = (r % 2) * 14; x < W; x += 28) px(x, y, P.seam, 1, 5);
    }
    // 지휘 자리 밑 깔개
    px(COLS[1] - 30, ROW0 + 18, P.rug, 60, 12); px(COLS[1] - 30, ROW0 + 18, shade(P.rug.length === 7 ? P.rug : '#dfe7f3', 0.92), 60, 1);
    // 창문 두 개 — 하늘색은 지금 시각(낮·저녁·밤)
    const sky = hour >= 7 && hour < 17 ? ['#bfe0f5', '#d9eefb'] : hour >= 17 && hour < 19 ? ['#f7b98a', '#f9d4a8'] : ['#1f2a4d', '#2a375e'];
    const win = (x, y, w, h) => {
      px(x - 1, y - 1, P.frame, w + 2, h + 2); px(x, y, sky[0], w, h); px(x, y, sky[1], w, Math.floor(h / 3));
      if (sky[0] === '#1f2a4d') { [[3, 3], [w - 6, 5], [Math.floor(w / 2), 2], [6, h - 5]].forEach(([a, b]) => px(x + a, y + b, '#f4e9a8')); }
      else if (hour < 17) { const cx = x + ((reduce ? 6 : Math.floor(f / 6)) % (w + 8)) - 6; for (const [a, b, c] of [[0, 3, 6], [2, 2, 3], [1, 4, 7]]) { const s = Math.max(x, cx + a), e = Math.min(x + w, cx + a + c); if (e > s) px(s, y + b + 3, '#ffffff', e - s, 1); } }
      px(x + Math.floor(w / 2), y, P.frame, 1, h); px(x, y + Math.floor(h / 2), P.frame, w, 1);
      px(x - 2, y + h + 1, P.base, w + 4, 2);   // 창틀 선반
    };
    win(8, 7, 30, 22); win(178, 7, 30, 22);
    // 칠판(오늘 할 일 그래프 느낌)
    px(88, 6, P.frame, 64, 28); px(89, 7, P.board, 62, 25);
    [[94, 12, '#3182f6', 22], [94, 17, '#03b26c', 34], [94, 22, '#f5b800', 14], [94, 27, '#f04452', 8]].forEach(([x, y, c, w]) => px(x, y, c, w, 2));
    px(130, 12, '#8b95a1', 16, 1); px(130, 16, '#8b95a1', 12, 1); px(130, 20, '#8b95a1', 14, 1);
    px(90, 33, P.base, 60, 2);
    // 시계(지금 시각)
    const ccx = 164, ccy = 14;
    px(ccx - 5, ccy - 6, P.frame, 11, 13); px(ccx - 6, ccy - 5, P.frame, 13, 11); px(ccx - 4, ccy - 5, '#ffffff', 9, 11); px(ccx - 5, ccy - 4, '#ffffff', 11, 9);
    const hand = (ang, len, c) => { for (let i = 1; i <= len; i++) px(ccx + Math.round(Math.sin(ang) * i), ccy - Math.round(Math.cos(ang) * i), c); };
    const mins = new Date().getMinutes();
    hand(((hour % 12) + mins / 60) / 12 * 2 * Math.PI, 3, '#191f28'); hand(mins / 60 * 2 * Math.PI, 4, '#4e5968'); px(ccx, ccy, '#f04452');
    // 화분 두 개
    const plant = (x, y) => { px(x, y + 8, P.pot, 8, 6); px(x - 1, y + 7, shade(P.pot, 0.85), 10, 2); px(x + 2, y, P.leaf, 4, 8); px(x, y + 2, P.leaf2, 3, 5); px(x + 5, y + 1, P.leaf2, 3, 6); px(x + 3, y - 2, P.leaf, 2, 3); };
    plant(50, WALL - 12); plant(216 - 30, WALL - 12);
    // 서버 선반(오른쪽 벽) — 불이 깜빡
    px(222, 10, P.rack, 14, 48); px(221, 56, shade(P.rack, 0.8), 16, 2);
    for (let y = 13, i = 0; y < 54; y += 6, i++) { px(224, y, P.rack2, 10, 4); px(232, y + 1, ((f + i * 3) % 7 < 4 || reduce) ? '#3ddc84' : '#1f6b44', 1, 1); px(230, y + 1, i % 3 === 0 ? '#3182f6' : P.rack2, 1, 1); }
    // 정수기(왼쪽 벽)
    px(2, 24, '#dfe6ee', 4, 6); px(1, 30, '#9aa4b1', 6, 16); px(2, 33, '#3182f6', 1, 1);
  }

  // ── 직원 한 자리(원래 48×36 그림 좌표를 그 자리로 옮겨 그림) ─────────────────
  function drawSeat(g, cx, oy, look, kind, f, selected) {
    const P = PAL();
    const tx = cx - 24, ty = oy - 6;
    const px = (x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x + tx, y + ty, w, h); };
    if (selected) { px(4, 31, P.sel, 40, 3); px(6, 30, P.sel, 36, 1); px(6, 34, P.sel, 36, 1); }
    // 의자 등받이
    px(14, 10, P.chair, 20, 10); px(13, 11, P.chair, 1, 9); px(34, 11, P.chair, 1, 9);
    const oyy = 6 + (kind === 'idle' ? 1 : 0), ox = 16;
    const C = { H: look.hair, S: SKIN, s: SKIN2, E: EYE, M: '#b5524a', B: look.shirt, b: shade(look.shirt, 0.78) };
    BODY.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      let c = C[ch];
      if (ch === 'E' && kind === 'idle') { c = SKIN; px(ox + x, oyy + y + 1, EYE); }
      if (ch === 'E' && kind === 'blocked') px(ox + x, oyy + y - 1, EYE);
      if (ch === 'M' && kind === 'idle') c = SKIN2;
      px(ox + x, oyy + y, c);
    }));
    if (look.glasses) { px(ox + 4, oyy + 4, '#222', 3, 1); px(ox + 9, oyy + 4, '#222', 3, 1); px(ox + 7, oyy + 4, '#222', 2, 1); }
    if (look.hat) { px(ox + 3, oyy - 1, look.hat, 10, 3); px(ox + 2, oyy + 2, shade(look.hat, 0.8), 12, 1); }
    if (look.prop === 'headset') { px(ox + 2, oyy + 1, '#222', 1, 5); px(ox + 13, oyy + 1, '#222', 1, 5); px(ox + 3, oyy, '#222', 10, 1); px(ox + 12, oyy + 6, '#222', 1, 1); px(ox + 10, oyy + 7, '#222', 2, 1); }
    if (look.prop === 'tie') { px(ox + 7, oyy + 9, '#c0392b', 2, 1); px(ox + 7, oyy + 10, '#a93226', 2, 3); px(ox + 6, oyy + 9, '#fff', 1, 1); px(ox + 9, oyy + 9, '#fff', 1, 1); }
    // 책상(지휘는 넓은 책상 + 앞판)
    const dx = look.boss ? 4 : 8, dw = look.boss ? 40 : 32;
    px(dx, 20, P.desk, dw, 2); px(dx, 22, P.desk2, dw, 1);
    if (look.boss) { px(dx + 1, 23, shade(P.desk, 0.9), dw - 2, 8); px(dx + 3, 25, P.desk2, dw - 6, 1); px(22, 27, '#e2b100', 4, 2); }
    else { px(dx + 1, 23, P.desk2, 2, 9); px(dx + dw - 3, 23, P.desk2, 2, 9); }
    // 노트북(일할 때 위 가장자리가 빛남)
    px(18, 14, P.lid2, 12, 6); px(19, 15, P.lid, 10, 4); px(23, 16, '#fff', 2, 2);
    if (kind === 'busy') px(18, 14, (reduce || f % 4 < 2) ? '#7fd3ff' : '#4fa8e0', 12, 1);
    if (kind === 'blocked') px(18, 14, (reduce || f % 6 < 3) ? '#ff6b5b' : '#c0392b', 12, 1);
    const up = kind === 'busy' && !reduce ? f % 2 : 0;
    px(16, 19 - up, SKIN, 2, 1); px(30, 19 - (kind === 'busy' && !reduce ? 1 - (f % 2) : 0), SKIN, 2, 1);
    // 책상 소품
    const p = look.prop;
    if (p === 'box') { px(32, 16, '#c9935a', 6, 4); px(32, 16, '#a8743f', 6, 1); px(34, 16, '#e8d3a8', 2, 4); }
    if (p === 'mail') { px(32, 17, '#fff', 6, 3); px(32, 17, '#cfd6e0', 6, 1); px(34, 18, '#c0392b', 2, 1); px(31, 16, '#fff', 6, 1); }
    if (p === 'coin') { [0, 1, 2].forEach((i) => { px(33, 19 - i, '#e2b100', 4, 1); px(33, 19 - i, '#b38900', 1, 1); }); px(36, 15, '#ffd84a', 2, 2); }
    if (p === 'chart') { px(32, 14, '#fff', 6, 6); px(33, 18, '#3182f6', 1, 1); px(34, 17, '#3182f6', 1, 2); px(35, 16, '#3182f6', 1, 3); px(36, 15, '#03b26c', 1, 4); }
    if (p === 'magnifier') { px(33, 16, '#555', 3, 1); px(33, 18, '#555', 3, 1); px(33, 17, '#555', 1, 1); px(35, 17, '#555', 1, 1); px(34, 17, '#bfe0f5', 1, 1); px(36, 19, '#7a4a20', 2, 1); }
    if (p === 'wrench') { px(32, 19, '#8a94a3', 6, 1); px(31, 18, '#8a94a3', 2, 1); px(31, 20, '#8a94a3', 2, 1); }
    if (p === 'tie') { px(32, 17, '#fff', 5, 3); px(33, 18, '#6b7385', 3, 1); px(10, 16, '#3182f6', 1, 4); px(11, 16, '#e8f3ff', 3, 2); px(9, 19, '#555', 3, 1); }   // 결재 서류 + 작은 깃발
    if (p === 'headset') { px(32, 18, '#2f3e5c', 5, 2); px(33, 17, '#2f3e5c', 3, 1); }
    if (p === 'server') { px(32, 15, '#2a2e36', 6, 5); px(33, 16, '#3d434e', 4, 1); px(33, 18, '#3d434e', 4, 1); px(36, 16, (f % 5 < 3 || reduce) ? '#3ddc84' : '#1f6b44', 1, 1); }
    // 머리 위 표시
    const bob = reduce ? 0 : (f % 6 < 3 ? 0 : 1);
    if (kind === 'todo' || kind === 'blocked') { const c = kind === 'todo' ? '#f5a400' : '#f04452'; px(23, -1 + bob, c, 2, 3); px(23, 3 + bob, c, 2, 1); }
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
  const splitName = (name) => { const m = String(name || '').match(/^(\S+)\s+(.*)$/); return m && /\p{Extended_Pictographic}/u.test(m[1]) ? [m[1], m[2]] : ['🙂', name || '']; };

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
    if (m.wake) out.push(`📡 ${m.wake}이면 바로 깨어나요`);
    if (m.cards) out.push(`🟠 #할-일 ${m.cards}건${m.urgent ? `(긴급 ${m.urgent})` : ''}${m.top_card ? ' — ' + clip(m.top_card, 70) : ''}`);
    for (const t of s.tasks || []) {
      const mine = m.domain === 'commander' || (t.domains || []).includes(m.domain);
      if (mine && t.state === 'wait') out.push(`✋ 승인 기다림: ${clip(t.title, 60)}`);
    }
    if (m.debt) out.push(`🧹 기술부채 ${m.debt}건 — ${clip((m.debt_top || {}).text, 60)}`);
    return out;
  }

  // ── 화면 ─────────────────────────────────────────────────────────────────
  let frame = 0, timer = null, sel = null, last = null, order = [], H = heightFor(9);
  const STATE_TXT = { busy: '일하는 중', todo: '할 일 있음', blocked: '막혔어요', idle: '쉬는 중' };
  const look = (d) => LOOK[d] || { hair: '#333', shirt: '#777' };
  const kinds = new Map();
  let cv = null;

  function paint() {
    if (!cv || !last) return;
    const g = cv.getContext('2d');
    drawRoom(g, H, frame, +(last.now || '').slice(11, 13) || new Date().getHours());
    order.forEach((d, i) => { const { cx, oy } = seatPos(i); drawSeat(g, cx, oy, look(d), kinds.get(d) || 'idle', frame, sel === d); });
  }

  function select(d) {
    sel = sel === d ? null : d;
    document.querySelectorAll('[data-seat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.seat === sel)));
    paint(); renderDetail();
    if (sel) { const box = document.getElementById('office-detail'); if (box && window.innerWidth < 760) box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
  }

  function renderDetail() {
    const box = document.getElementById('office-detail'); if (!box || !last) return;
    box.textContent = '';
    const m = (last.team || []).find((x) => x.domain === sel);
    box.hidden = !m;
    if (!m) return;
    const [emo, nm] = splitName(m.name);
    const head = E('div', 'od-head');
    const av = E('span', 'avatar k-' + (kinds.get(m.domain) || 'idle'), emo);
    const tt = E('div', 'od-title'); tt.append(E('div', 'od-name', nm), E('div', 'od-role', m.role || ''));
    const x = E('button', 'icon-btn', '✕'); x.type = 'button'; x.setAttribute('aria-label', '닫기'); x.onclick = () => select(sel);
    head.append(av, tt, x); box.append(head);
    const col = (title, items, empty) => {
      const c = E('div', 'od-col'); c.append(E('div', 'od-t', title));
      const ul = E('ul'); (items.length ? items : [empty]).forEach((it) => {
        const li = E('li', items.length ? '' : 'muted');
        if (it && typeof it === 'object') { li.append(E('span', 'od-when', day(it.at, last.now)), document.createTextNode(it.text)); } else li.textContent = it;
        ul.append(li);
      });
      c.append(ul); return c;
    };
    const g = E('div', 'od-grid');
    g.append(col('하는 일', doing(m, last), '지금은 쉬고 있어요'), col('할 일', upcoming(m, last), '정해진 다음 일이 없어요'), col('했던 일', history(m, last), '최근 기록이 없어요'));
    box.append(g);
    if (m.top_card_link) { const a = E('a', 'btn sm', '디스코드 #할-일에서 열기'); a.href = m.top_card_link; a.target = '_blank'; a.rel = 'noopener'; box.append(a); }
  }

  function build(root, s) {
    root.textContent = '';
    const room = E('div', 'room'); room.style.aspectRatio = `${W} / ${H}`;
    cv = E('canvas'); cv.width = W; cv.height = H; cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', '바른청년 사무실 그림 — 직원 상태는 아래 목록에서도 볼 수 있어요');
    room.append(cv);
    order.forEach((d, i) => {
      const { cx, oy } = seatPos(i);
      const b = E('button', 'st'); b.type = 'button'; b.dataset.seat = d; b.setAttribute('aria-pressed', 'false');
      b.style.left = `${(cx - 19) / W * 100}%`; b.style.top = `${(oy - 3) / H * 100}%`;
      b.style.width = `${38 / W * 100}%`; b.style.height = `${32 / H * 100}%`;
      b.append(E('span', 'bubble'), E('span', 'tag'));
      b.onclick = () => select(d);
      room.append(b);
    });
    const list = E('ul', 'roster'); list.id = 'office-roster';
    root.append(room, list);
  }

  function render(s) {
    last = s;
    const root = document.getElementById('office'); if (!root) return;
    const byDom = new Map((s.team || []).map((m) => [m.domain, m]));
    const next = [...SEATS.filter((d) => byDom.has(d)), ...[...byDom.keys()].filter((d) => !SEATS.includes(d))];
    if (next.join(',') !== order.join(',') || !cv || !root.contains(cv)) { order = next; H = heightFor(order.length); build(root, s); }
    const roster = document.getElementById('office-roster'); roster.textContent = '';
    const cnt = { busy: 0, todo: 0, blocked: 0, idle: 0 };
    for (const d of order) {
      const m = byDom.get(d); const kind = kindOf(m.state); kinds.set(d, kind); cnt[kind]++;
      const [emo, nm] = splitName(m.name);
      const say = m.now ? clip(m.now, 64) : (kind === 'blocked' || kind === 'todo') && m.top_card ? clip(m.top_card, 64) : '';
      const b = root.querySelector(`.st[data-seat="${d}"]`);
      b.className = `st k-${kind}`;
      const bub = b.querySelector('.bubble'); bub.textContent = say; bub.hidden = !say;
      const tag = b.querySelector('.tag'); tag.textContent = ''; tag.append(E('i', 'dot'), document.createTextNode(nm));
      b.setAttribute('aria-label', `${nm}, ${STATE_TXT[kind]}${say ? '. ' + say : ''}`);
      // 아래 목록(좁은 화면·스크린리더용 — 그림과 같은 내용)
      const L = m.last || {}; const nx = m.next || {};
      const li = E('li'); const row = E('button', 'row'); row.type = 'button'; row.dataset.seat = d; row.setAttribute('aria-pressed', String(sel === d));
      row.onclick = () => select(d);
      const body = E('span', 'row-body');
      body.append(E('span', 'row-title', nm), E('span', 'row-sub', say || (L.at ? `${day(L.at, s.now)} ${L.kind === 'skip' ? '할 일 없어 건너뜀' : clip(L.text, 70)}` : '최근 기록 없음')));
      const right = E('span', 'row-right'); right.append(E('span', 'badge k-' + kind, STATE_TXT[kind]), E('span', 'row-meta', nx.at ? `다음 ${day(nx.at, s.now)}` : (m.wake ? '이벤트로 깨어남' : '')));
      row.append(E('span', 'avatar k-' + kind, emo), body, right);
      li.append(row); roster.append(li);
    }
    const c = document.getElementById('office-count');
    if (c) {
      c.textContent = '';
      for (const [k, lab] of [['busy', '일하는 중'], ['todo', '할 일 있음'], ['blocked', '막힘'], ['idle', '쉬는 중']]) if (cnt[k] || k === 'busy') c.append(E('span', 'badge k-' + k, `${lab} ${cnt[k]}`));
    }
    paint(); renderDetail();
    if (!timer && !reduce) timer = setInterval(() => { if (document.hidden || !cv || !cv.offsetParent) return; frame++; paint(); }, 260);
  }
  if (darkQ && darkQ.addEventListener) darkQ.addEventListener('change', paint);
  window.barunOffice = render;
  window.barunOfficeRepaint = paint;
})();
