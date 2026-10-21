// 🏢 사무실 — 에이전트(직원) 아홉 명이 한 사무실에 모여 앉아 일한다.
// 2026-10-21 사용자: "캐릭터를 한 사무실에" → 2026-10-22: "정보 밀도도 높이고 좀 더 귀엽게, 말풍선 크기 들쭉날쭉 → 사무실처럼 모아 놓고, 마우스오버하면 상세, 너무 크게 나오는 것도 문제".
// 자료는 /api/state의 team(notify/team.py data() — 디스코드 #상황판 '직원 현황'과 같은 것) + jobs[].runs(실행기 회차) + tasks(디스코드 작업).
// 그림: 작은 도트 캔버스(W×H)를 왼쪽 칸 폭에 맞게 키움(image-rendering: pixelated). 팀장 책상 + 2인용 책상 네 개(왼쪽 운영팀·오른쪽 상품팀).
// 글: 캔버스 위 HTML — 머리 위 같은 크기 상태 표시(●●● 일하는 중 · ! 결재 대기 · ! 막힘), 이름표, 마우스를 올리면(키보드 초점도) 같은 크기 카드.
//     오른쪽은 촘촘한 직원 목록(지금 하는 일·다음 회차). 누르면 아래에 한 일·할 일 전체. 좁은 화면은 그림 아래 목록.
// 움직임 줄이기 설정(prefers-reduced-motion)이면 멈춘 그림 한 장만.
(function () {
  const W = 256, H = 150, WALL = 34;
  // 자리(고정 — 상태로 정렬하면 자리가 바뀌어 찾기 어려움). y = 머리 꼭대기
  const SPOT = {
    commander: { x: 128, y: 26, boss: true },
    orders: { x: 46, y: 60, pod: 'L1' }, mail: { x: 82, y: 60, pod: 'L1' },
    inquiry: { x: 46, y: 100, pod: 'L2' }, close: { x: 82, y: 100, pod: 'L2' },
    pricing: { x: 174, y: 60, pod: 'R1' }, sourcing: { x: 210, y: 60, pod: 'R1' },
    improve: { x: 174, y: 100, pod: 'R2' }, infra: { x: 210, y: 100, pod: 'R2' },
  };
  const PODS = { L1: [26, 102, 60], L2: [26, 102, 100], R1: [154, 230, 60], R2: [154, 230, 100] };   // [왼끝, 오른끝, 머리 y]
  const LOOK = {
    commander: { hair: '#2b2118', shirt: '#2f3e5c', prop: 'flag', tie: true },
    orders:    { hair: '#5a3a22', shirt: '#e2703a', prop: 'box', hat: '#3182f6' },
    mail:      { hair: '#1c1c22', shirt: '#3d9c74', prop: 'mail', bun: true },
    pricing:   { hair: '#8a5a2b', shirt: '#d3a52b', prop: 'coin' },
    inquiry:   { hair: '#3a2a4a', shirt: '#8358c4', prop: 'cup', headset: true, bun: true },
    close:     { hair: '#6b6b6b', shirt: '#4a78c0', prop: 'chart', glasses: true },
    sourcing:  { hair: '#a0522d', shirt: '#2d9a9a', prop: 'magnifier', glasses: true },
    improve:   { hair: '#2b2118', shirt: '#5b6b7a', prop: 'wrench', hat: '#f5b800' },
    infra:     { hair: '#141414', shirt: '#38404c', prop: 'server', headset: true },
  };
  const SKIN = '#f6d2b0', SKIN2 = '#e2b18b', EYE = '#26232b', BLUSH = '#f3a3a0';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const darkQ = window.matchMedia && matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme !== 'light' && darkQ && darkQ.matches);
  const PAL = () => (isDark()
    ? { wall: '#2b2e38', wall2: '#272a33', base: '#3b404c', floor: '#3a342c', floor2: '#352f27', seam: '#2c2720', desk: '#8a6446', desk2: '#6a4a32', desk3: '#55392a', chair: '#1a1c22', lid: '#9aa2b2', lid2: '#7a8292', frame: '#4c5260', board: '#d9dee6', pot: '#8a5a3c', leaf: '#45a06a', leaf2: '#327a52', rack: '#1a1d23', rack2: '#2b3039', rug: '#2e3547', rug2: '#384160', shadow: 'rgba(0,0,0,.28)', sel: 'rgba(69,147,252,.55)', part: '#4a5060' }
    : { wall: '#f5f1ea', wall2: '#eee8de', base: '#d4c9b6', floor: '#ead9b8', floor2: '#e4d0ab', seam: '#d6bf95', desk: '#b07d52', desk2: '#93633d', desk3: '#7a4f30', chair: '#4a4f5c', lid: '#cdd3dc', lid2: '#aeb6c2', frame: '#bfb6a8', board: '#ffffff', pot: '#d08454', leaf: '#56b97c', leaf2: '#3f9462', rack: '#2c3038', rack2: '#40464f', rug: '#e3ebf7', rug2: '#cfdcf0', shadow: 'rgba(80,60,30,.16)', sel: 'rgba(49,130,246,.45)', part: '#c9d2de' });

  // 14×13 상반신 — 큰 머리·세로 눈·볼(귀엽게). H 머리 S 피부 s 그늘 E 눈 P 볼 M 입 B 옷 b 옷 그늘
  const BODY = [
    '....HHHHHH....',
    '..HHHHHHHHHH..',
    '.HHHHHHHHHHHH.',
    '.HHSSSSSSSSHH.',
    '.HSSESSSSESSH.',
    '.SSSESSSSESSS.',
    '.SPPSSSSSSPPS.',
    '..SSSSMMSSSS..',
    '...SSSSSSSS...',
    '....ssssss....',
    '..BBBBBBBBBB..',
    '.BBBBBBBBBBBB.',
    '.BbBBBBBBBBbB.',
  ];
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('');
  };
  const kindOf = (st) => (st || '').startsWith('🟢') ? 'busy' : (st || '').startsWith('🔴') ? 'blocked' : (st || '').startsWith('🟡') ? 'todo' : 'idle';

  // ── 방 ────────────────────────────────────────────────────────────────────
  function drawRoom(g, f, hour) {
    const P = PAL();
    const px = (x, y, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    px(0, 0, P.wall, W, WALL); for (let x = 0; x < W; x += 8) px(x, 0, P.wall2, 1, WALL);
    px(0, WALL - 2, P.base, W, 2);
    for (let y = WALL, r = 0; y < H; y += 6, r++) {
      px(0, y, r % 2 ? P.floor : P.floor2, W, 6); px(0, y + 5, P.seam, W, 1);
      for (let x = (r % 2) * 16; x < W; x += 32) px(x, y, P.seam, 1, 5);
    }
    // 창문 — 하늘색은 지금 시각
    const night = !(hour >= 7 && hour < 19), dusk = hour >= 17 && hour < 19;
    const sky = night ? ['#1f2a4d', '#2a375e'] : dusk ? ['#f7b98a', '#f9d4a8'] : ['#bfe0f5', '#d9eefb'];
    const win = (x, y, w, h) => {
      px(x - 1, y - 1, P.frame, w + 2, h + 2); px(x, y, sky[0], w, h); px(x, y, sky[1], w, Math.floor(h / 3));
      if (night) [[3, 3], [w - 6, 5], [Math.floor(w / 2) + 2, 2], [5, h - 5], [w - 4, h - 4]].forEach(([a, b]) => px(x + a, y + b, '#f4e9a8'));
      else { const cx = x + ((reduce ? 6 : Math.floor(f / 5)) % (w + 10)) - 8; for (const [a, b, c] of [[0, 3, 7], [2, 2, 3], [1, 4, 8]]) { const s = Math.max(x, cx + a), e = Math.min(x + w, cx + a + c); if (e > s) px(s, y + b + 2, '#ffffff', e - s, 1); } }
      px(x + Math.floor(w / 2), y, P.frame, 1, h); px(x, y + Math.floor(h / 2), P.frame, w, 1);
      px(x - 2, y + h + 1, P.base, w + 4, 2);
    };
    win(12, 6, 30, 18); win(176, 6, 30, 18);
    // 칠판(팀장 뒤)
    px(100, 4, P.frame, 56, 24); px(101, 5, P.board, 54, 21);
    [[105, 9, '#3182f6', 18], [105, 13, '#03b26c', 28], [105, 17, '#f5b800', 12], [105, 21, '#f04452', 7]].forEach(([x, y, c, w]) => px(x, y, c, w, 2));
    px(138, 9, '#8b95a1', 13, 1); px(138, 13, '#8b95a1', 10, 1); px(138, 17, '#8b95a1', 12, 1);
    // 시계
    const ccx = 165, ccy = 12;
    px(ccx - 4, ccy - 5, P.frame, 9, 11); px(ccx - 5, ccy - 4, P.frame, 11, 9); px(ccx - 3, ccy - 4, '#ffffff', 7, 9); px(ccx - 4, ccy - 3, '#ffffff', 9, 7);
    const hand = (ang, len, c) => { for (let i = 1; i <= len; i++) px(ccx + Math.round(Math.sin(ang) * i), ccy - Math.round(Math.cos(ang) * i), c); };
    const mins = new Date().getMinutes();
    hand(((hour % 12) + mins / 60) / 12 * 2 * Math.PI, 2, '#191f28'); hand(mins / 60 * 2 * Math.PI, 3, '#4e5968'); px(ccx, ccy, '#f04452');
    // 벽 액자·게시판
    px(56, 8, P.frame, 18, 14); px(57, 9, '#fff4d6', 16, 12); px(59, 11, '#f5b800', 4, 3); px(64, 12, '#3182f6', 6, 1); px(64, 15, '#8b95a1', 7, 1); px(59, 17, '#f04452', 3, 2);
    // 서버 선반(오른쪽 구석) — 불이 깜빡
    px(238, 8, P.rack, 14, 40); px(237, 46, shade(P.rack, 0.8), 16, 2);
    for (let y = 11, i = 0; y < 44; y += 5, i++) { px(240, y, P.rack2, 10, 3); px(248, y + 1, ((f + i * 3) % 7 < 4 || reduce) ? '#3ddc84' : '#1f6b44', 1, 1); px(246, y + 1, i % 3 === 0 ? '#3182f6' : P.rack2, 1, 1); }
    // 정수기·커피(왼쪽 구석)
    px(3, 16, '#dfe6ee', 5, 7); px(2, 23, '#9aa4b1', 7, 18); px(4, 27, '#3182f6', 1, 1); px(4, 30, '#f04452', 1, 1);
    // 팀장 깔개
    px(98, 40, P.rug, 60, 18); px(98, 40, P.rug2, 60, 1); px(98, 57, P.rug2, 60, 1); px(98, 40, P.rug2, 1, 18); px(157, 40, P.rug2, 1, 18);
    // 화분(벽 앞·통로)
    const plant = (x, y, big) => {
      px(x, y + 8, P.pot, 7, 6); px(x - 1, y + 7, shade(P.pot, 0.85), 9, 2);
      px(x + 2, y, P.leaf, 3, 8); px(x, y + 2, P.leaf2, 3, 5); px(x + 4, y + 1, P.leaf2, 3, 6); if (big) { px(x + 1, y - 3, P.leaf, 2, 4); px(x + 4, y - 2, P.leaf, 2, 3); }
    };
    plant(86, 20, true); plant(222, 20, true); plant(125, 128, false);
    // 통로 가운데 복사기
    px(118, 74, '#d9dee6', 20, 12); px(118, 74, '#eef1f5', 20, 3); px(120, 78, '#3d434e', 16, 2); px(134, 77, (f % 8 < 4 || reduce) ? '#3ddc84' : '#2a8a58', 1, 1); px(119, 86, '#aab2bf', 18, 3); px(121, 71, '#ffffff', 14, 3);
  }

  // 2인용 책상(사람을 그린 뒤 덮어 아랫몸을 가림) + 칸막이
  function drawPodDesk(g, x0, x1, y) {
    const P = PAL();
    const px = (x, yy, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, yy, w, h); };
    const top = y + 14;
    px(x0 - 2, top - 7, P.part, 2, 9); px(x1, top - 7, P.part, 2, 9);         // 양쪽 칸막이
    px(x0, top, P.desk, x1 - x0, 2); px(x0, top + 2, P.desk2, x1 - x0, 1);
    px(x0 + 1, top + 3, P.desk3, x1 - x0 - 2, 6); px(x0 + 3, top + 5, P.desk2, x1 - x0 - 6, 1);
    px(Math.round((x0 + x1) / 2), top + 3, P.desk2, 1, 6);                    // 가운데 서랍 이음
    px(x0 + 2, top + 9, P.shadow, x1 - x0 - 4, 2);
  }
  function drawBossDesk(g, cx, y) {
    const P = PAL();
    const px = (x, yy, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, yy, w, h); };
    const top = y + 14;
    px(cx - 20, top, P.desk, 40, 2); px(cx - 20, top + 2, P.desk2, 40, 1);
    px(cx - 19, top + 3, shade(P.desk, 0.88), 38, 8); px(cx - 16, top + 5, P.desk2, 32, 1);
    px(cx - 4, top + 7, '#e2b100', 8, 2); px(cx - 3, top + 7, '#fff2b8', 2, 1);   // 이름패
    px(cx - 18, top + 11, P.shadow, 36, 2);
  }

  // 직원 한 명(머리 꼭대기 x,y — 몸 가운데 x)
  function drawPerson(g, d, cx, y, look, kind, f) {
    const P = PAL();
    const ox = cx - 7;
    const px = (x, yy, c, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, yy, w, h); };
    px(cx - 8, y + 5, P.chair, 16, 10); px(cx - 9, y + 6, P.chair, 1, 8); px(cx + 8, y + 6, P.chair, 1, 8);   // 의자 등받이
    const sway = kind === 'idle' ? 1 : 0;
    const C = { H: look.hair, S: SKIN, s: SKIN2, E: EYE, P: BLUSH, M: '#c25a52', B: look.shirt, b: shade(look.shirt, 0.78) };
    BODY.forEach((row, yy) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      let c = C[ch];
      if (ch === 'E' && kind === 'idle' && yy === 4) c = SKIN;                         // 졸음 — 눈 감음(아랫줄만)
      if (ch === 'M' && kind === 'idle') c = SKIN2;
      if (ch === 'M' && kind === 'busy' && (reduce || f % 10 < 7)) c = SKIN2;           // 집중
      px(ox + x, y + yy + (yy < 10 ? sway : 0), c);
    }));
    const hy = y + sway;
    if (kind === 'blocked') { px(ox + 3, hy + 3, EYE, 2, 1); px(ox + 9, hy + 3, EYE, 2, 1); }   // 놀란 눈썹
    if (kind === 'busy' || kind === 'todo') { px(ox + 4, hy + 4, '#ffffff'); px(ox + 9, hy + 4, '#ffffff'); }   // 반짝이는 눈
    if (look.bun) { px(ox + 5, hy - 2, look.hair, 4, 2); px(ox + 6, hy - 3, look.hair, 2, 1); }
    if (look.glasses) { const k = '#2a2a33'; for (const gx of [3, 8]) { px(ox + gx, hy + 3, k, 3, 1); px(ox + gx, hy + 4, k, 1, 2); px(ox + gx + 2, hy + 4, k, 1, 2); px(ox + gx, hy + 6, k, 3, 1); } px(ox + 6, hy + 4, k, 2, 1); }   // 테 안경(눈은 보임)
    if (look.hat) { px(ox + 2, hy - 1, look.hat, 10, 2); px(ox + 1, hy + 1, shade(look.hat, 0.8), 12, 1); px(ox + 6, hy - 2, shade(look.hat, 1.1), 2, 1); }
    if (look.headset) { px(ox, hy + 3, '#2a2a33', 1, 4); px(ox + 13, hy + 3, '#2a2a33', 1, 4); px(ox + 1, hy, '#2a2a33', 12, 1); px(ox + 12, hy + 7, '#2a2a33', 1, 1); px(ox + 10, hy + 8, '#2a2a33', 2, 1); }
    if (look.tie) { px(cx - 1, y + 10, '#c0392b', 2, 3); px(cx - 2, y + 10, '#fff', 1, 1); px(cx + 1, y + 10, '#fff', 1, 1); }
    // 노트북(뒷면 — 책상 위, 얼굴은 가리지 않음). 일할 때 화면 빛이 위로
    px(cx - 5, y + 11, P.lid2, 10, 3); px(cx - 4, y + 12, P.lid, 8, 2); px(cx - 1, y + 12, '#fff', 2, 1);
    if (kind === 'busy') px(cx - 5, y + 10, (reduce || f % 4 < 2) ? '#7fd3ff' : '#4fa8e0', 10, 1);
    if (kind === 'blocked') px(cx - 5, y + 10, (reduce || f % 6 < 3) ? '#ff7b6b' : '#c0392b', 10, 1);
    const up = kind === 'busy' && !reduce ? f % 2 : 0;
    px(cx - 7, y + 13 - up, SKIN, 2, 1); px(cx + 5, y + 13 - (kind === 'busy' && !reduce ? 1 - (f % 2) : 0), SKIN, 2, 1);
    // 책상 소품(오른쪽)
    const q = cx + 9, t = y + 11, p = look.prop;
    if (p === 'box') { px(q, t, '#c9935a', 5, 3); px(q, t, '#a8743f', 5, 1); px(q + 2, t, '#e8d3a8', 1, 3); }
    if (p === 'mail') { px(q, t + 1, '#fff', 5, 2); px(q, t + 1, '#cfd6e0', 5, 1); px(q + 2, t + 2, '#e04848', 1, 1); px(q + 1, t, '#fff', 4, 1); }
    if (p === 'coin') { [0, 1, 2].forEach((i) => { px(q, t + 2 - i, '#e2b100', 4, 1); px(q, t + 2 - i, '#b38900', 1, 1); }); }
    if (p === 'chart') { px(q, t - 1, '#fff', 5, 4); px(q + 1, t + 2, '#3182f6', 1, 1); px(q + 2, t + 1, '#3182f6', 1, 2); px(q + 3, t, '#03b26c', 1, 3); }
    if (p === 'magnifier') { px(q, t, '#555', 3, 1); px(q, t + 2, '#555', 3, 1); px(q, t + 1, '#555', 1, 1); px(q + 2, t + 1, '#555', 1, 1); px(q + 1, t + 1, '#bfe0f5', 1, 1); px(q + 3, t + 3, '#7a4a20', 2, 1); }
    if (p === 'wrench') { px(q, t + 2, '#8a94a3', 5, 1); px(q - 1, t + 1, '#8a94a3', 2, 1); px(q - 1, t + 3, '#8a94a3', 2, 1); }
    if (p === 'cup') { px(q, t, '#ffffff', 3, 3); px(q + 3, t + 1, '#ffffff', 1, 1); px(q, t, '#8b5a3c', 3, 1); if (!reduce && f % 8 < 4) px(q + 1, t - 2, '#c8ccd3', 1, 1); }
    if (p === 'server') { px(q, t - 1, '#2a2e36', 5, 4); px(q + 1, t, '#3d434e', 3, 1); px(q + 3, t + 1, (f % 5 < 3 || reduce) ? '#3ddc84' : '#1f6b44', 1, 1); }
    if (p === 'flag') { px(cx - 14, y + 6, '#555', 1, 8); px(cx - 13, y + 6, '#3182f6', 4, 3); px(cx + 9, y + 11, '#fff', 5, 3); px(cx + 10, y + 12, '#6b7385', 3, 1); }
    // 상태 효과(그림 쪽 — 글은 HTML 표시)
    if (kind === 'blocked') { px(cx - 8, hy + 2, '#7fc4ff', 1, 2); px(cx - 9, hy + 3, '#7fc4ff', 1, 1); }
    if (kind === 'idle') {
      const z = reduce ? 0 : f % 12;
      const zz = (x, yy) => { px(x, yy, '#8a93a6', 3, 1); px(x + 1, yy + 1, '#8a93a6', 1, 1); px(x, yy + 2, '#8a93a6', 3, 1); };
      zz(cx + 7, y - 1 - Math.floor(z / 4)); if (z > 5) zz(cx + 11, y - 5);
    }
  }

  // ── 글자 정리 ──────────────────────────────────────────────────────────────
  const clip = (t, n) => { t = String(t || '').replace(/<@[!&]?\d+>/g, '@').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
  const hm = (iso) => iso ? iso.slice(11, 16) : '';
  const day = (iso, nowIso) => !iso ? '' : (iso.slice(0, 10) === (nowIso || '').slice(0, 10) ? hm(iso) : iso.slice(5, 10).replace('-', '/') + ' ' + hm(iso));
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const splitName = (name) => { const m = String(name || '').match(/^(\S+)\s+(.*)$/); return m && /\p{Extended_Pictographic}/u.test(m[1]) ? [m[1], m[2]] : ['🙂', name || '']; };
  const short = (nm) => nm.replace(/\s*\(.*\)\s*$/, '');
  const mini = (nm) => { const t = short(nm); return t === '고객문의' ? '문의' : t.split('·')[0]; };   // 좁은 화면 이름표(두 글자 안팎)

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
  // 한 줄 요약(목록·카드 공통): 지금 하는 일 > 결재 대기 카드 > 최근 회차
  function line(m, s) {
    if (m.now) return { k: '지금', t: clip(m.now, 90) };
    const kind = kindOf(m.state);
    if ((kind === 'todo' || kind === 'blocked') && m.top_card) return { k: kind === 'todo' ? '결재' : '막힘', t: clip(m.top_card, 90) };
    const L = m.last || {};
    if (L.at) return { k: day(L.at, s.now), t: L.kind === 'skip' ? '할 일 없어 건너뜀' : clip(L.text, 90) };
    return { k: '', t: '최근 기록 없음' };
  }

  // ── 화면 ─────────────────────────────────────────────────────────────────
  let frame = 0, timer = null, sel = null, hover = null, last = null, order = [], extra = [];
  const STATE_TXT = { busy: '일하는 중', todo: '결재 대기', blocked: '막혔어요', idle: '쉬는 중' };
  const look = (d) => LOOK[d] || { hair: '#333', shirt: '#777' };
  const kinds = new Map();
  let cv = null, pop = null;
  const spot = (d) => SPOT[d] || extra.find((x) => x.d === d) || { x: 20, y: 120 };

  function paint() {
    if (!cv || !last) return;
    const g = cv.getContext('2d');
    const P = PAL();
    drawRoom(g, frame, +(last.now || '').slice(11, 13) || new Date().getHours());
    const people = order.map((d) => ({ d, ...spot(d) }));
    for (const y of [...new Set(people.map((p) => p.y))].sort((a, b) => a - b)) {   // 한 줄씩: 사람을 그린 뒤 그 줄 책상으로 아랫몸을 덮는다
      const rowP = people.filter((p) => p.y === y);
      for (const p of rowP) drawPerson(g, p.d, p.x, p.y, look(p.d), kinds.get(p.d) || 'idle', frame);
      for (const pod of new Set(rowP.map((p) => p.pod).filter(Boolean))) drawPodDesk(g, PODS[pod][0], PODS[pod][1], y);
      for (const p of rowP) { if (p.boss) drawBossDesk(g, p.x, p.y); else if (!p.pod) drawPodDesk(g, p.x - 14, p.x + 14, p.y); }
      for (const p of rowP) {        // 고른·가리킨 직원: 의자 뒤 빛 + 책상 앞 밑줄
        const c = sel === p.d ? P.sel : hover === p.d ? P.sel.replace(/[\d.]+\)$/, '.25)') : null;
        if (c) { g.fillStyle = c; g.fillRect(p.x - 13, p.y + 25, 26, 2); g.fillRect(p.x - 10, p.y - 3, 20, 2); }
      }
    }
  }

  function select(d) {
    sel = sel === d ? null : d;
    document.querySelectorAll('[data-seat]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.seat === sel)));
    hidePop(); paint(); renderDetail();
    if (sel) { const box = document.getElementById('office-detail'); if (box) box.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }); }
  }

  function setHover(d) {
    if (hover === d) return;
    hover = d;
    document.querySelectorAll('#office-roster .row').forEach((r) => r.classList.toggle('hov', r.dataset.seat === d));
    document.querySelectorAll('.room .st').forEach((r) => r.classList.toggle('hov', r.dataset.seat === d));
    paint();
  }

  // 마우스를 올린 직원 카드(모두 같은 크기)
  function showPop(d, anchor) {
    const m = (last.team || []).find((x) => x.domain === d); if (!m || !pop) return;
    const kind = kinds.get(d) || 'idle';
    const [emo, nm] = splitName(m.name);
    pop.textContent = '';
    const h = E('div', 'op-head');
    const tt = E('div', 'op-title'); tt.append(E('div', 'op-name', nm), E('div', 'op-role', m.role || ''));
    h.append(E('span', 'avatar sm k-' + kind, emo), tt, E('span', 'badge k-' + kind, STATE_TXT[kind]));
    pop.append(h);
    const dl = E('dl', 'op-kv');
    const add = (k, v, cls) => { if (!v) return; dl.append(E('dt', null, k)); const dd = E('dd', cls || null); dd.textContent = v; dl.append(dd); };
    const now = doing(m, last);
    add('지금', now.length ? now.join(' · ') : (kind === 'idle' ? '쉬는 중' : ''));
    if ((kind === 'todo' || kind === 'blocked') && m.top_card) add(kind === 'todo' ? '결재' : '막힘', `${clip(m.top_card, 80)}${m.cards > 1 ? ` 외 ${m.cards - 1}건` : ''}`, 'warn');
    else if (m.cards) add('할 일', `#할-일 ${m.cards}건`);
    const L = m.last || {};
    if (L.at) add('최근', `${day(L.at, last.now)} · ${L.kind === 'skip' ? '할 일 없어 건너뜀' : clip(L.text, 90)}`);
    const nx = m.next || {};
    add('다음', nx.at ? `${day(nx.at, last.now)} ${nx.job || ''}` : (m.wake ? `${m.wake}이면 바로` : ''));
    if ((m.improving || []).length) add('개선 중', clip(m.improving.map((x) => x.what).join(' · '), 80));
    pop.append(dl, E('div', 'op-foot', '눌러서 한 일·할 일 전체 보기'));
    pop.hidden = false;
    // 자리 위치에 맞춰(위쪽 자리는 아래로, 아래쪽 자리는 위로) — 사무실 칸 안에서
    const wrap = pop.parentElement.getBoundingClientRect(), a = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = a.left + a.width / 2 - wrap.left - pw / 2;
    left = Math.max(4, Math.min(left, wrap.width - pw - 4));
    const below = a.top - wrap.top < wrap.height * 0.45;
    let top = below ? a.bottom - wrap.top + 6 : a.top - wrap.top - ph - 6;
    if (top < 4) top = a.bottom - wrap.top + 6;
    pop.style.left = `${left}px`; pop.style.top = `${top}px`;
    pop.dataset.side = below ? 'below' : 'above';
    anchor.setAttribute('aria-describedby', 'office-pop');
  }
  function hidePop() { if (pop) pop.hidden = true; document.querySelectorAll('[aria-describedby="office-pop"]').forEach((x) => x.removeAttribute('aria-describedby')); }

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

  function build(root) {
    root.textContent = '';
    const grid = E('div', 'office-grid');
    const wrap = E('div', 'room-wrap');
    const room = E('div', 'room'); room.style.aspectRatio = `${W} / ${H}`;
    cv = E('canvas'); cv.width = W; cv.height = H; cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', '바른청년 사무실 그림 — 직원 상태는 옆 목록에서도 볼 수 있어요');
    room.append(cv);
    order.forEach((d) => {
      const p = spot(d);
      const b = E('button', 'st'); b.type = 'button'; b.dataset.seat = d; b.setAttribute('aria-pressed', 'false');
      const bw = p.boss ? 32 : 30;
      b.style.left = `${(p.x - bw / 2) / W * 100}%`; b.style.top = `${(p.y - 3) / H * 100}%`;
      b.style.width = `${bw / W * 100}%`; b.style.height = `${(p.boss ? 28 : 26) / H * 100}%`;
      b.append(E('span', 'sig'), E('span', 'tag'));
      b.onclick = () => select(d);
      b.onmouseenter = () => { setHover(d); showPop(d, b); };
      b.onmouseleave = () => { setHover(null); hidePop(); };
      b.onfocus = () => { setHover(d); showPop(d, b); };
      b.onblur = () => { setHover(null); hidePop(); };
      room.append(b);
    });
    pop = E('div', 'office-pop'); pop.id = 'office-pop'; pop.setAttribute('role', 'tooltip'); pop.hidden = true;
    wrap.append(room, pop);
    const list = E('ul', 'roster'); list.id = 'office-roster'; list.setAttribute('aria-label', '직원 목록');
    grid.append(wrap, list);
    root.append(grid);
    root.onkeydown = (e) => { if (e.key === 'Escape') hidePop(); };
  }

  function render(s) {
    last = s;
    const root = document.getElementById('office'); if (!root) return;
    const byDom = new Map((s.team || []).map((m) => [m.domain, m]));
    const known = Object.keys(SPOT).filter((d) => byDom.has(d));
    const others = [...byDom.keys()].filter((d) => !SPOT[d]);
    extra = others.map((d, i) => ({ d, x: 20 + (i % 8) * 30, y: 122 }));   // 처음 보는 직원은 아래 줄에 임시 자리
    const next = [...known, ...others];
    if (next.join(',') !== order.join(',') || !cv || !root.contains(cv)) { order = next; build(root); }
    const roster = document.getElementById('office-roster'); roster.textContent = '';
    const cnt = { busy: 0, todo: 0, blocked: 0, idle: 0 };
    const rank = { blocked: 0, todo: 1, busy: 2, idle: 3 };
    const rows = [];
    for (const d of order) {
      const m = byDom.get(d); const kind = kindOf(m.state); kinds.set(d, kind); cnt[kind]++;
      const [emo, nm] = splitName(m.name);
      const ln = line(m, s);
      const b = root.querySelector(`.st[data-seat="${d}"]`);
      b.className = `st k-${kind}` + (hover === d ? ' hov' : '');
      const sig = b.querySelector('.sig'); sig.textContent = kind === 'busy' ? '' : (kind === 'idle' ? '' : '!');
      sig.hidden = kind === 'idle';
      const tag = b.querySelector('.tag'); tag.textContent = ''; tag.append(E('span', 'full', short(nm)), E('span', 'mini', mini(nm)));
      b.setAttribute('aria-label', `${nm}, ${STATE_TXT[kind]}. ${ln.t}`);
      rows.push({ d, m, kind, emo, nm, ln });
    }
    // 목록: 막힘·결재 대기·일하는 중 먼저(사장님이 볼 것부터), 같은 상태는 자리 순
    rows.sort((a, b) => rank[a.kind] - rank[b.kind] || order.indexOf(a.d) - order.indexOf(b.d));
    for (const { d, m, kind, emo, nm, ln } of rows) {
      const nx = m.next || {};
      const li = E('li'); const row = E('button', 'row'); row.type = 'button'; row.dataset.seat = d; row.setAttribute('aria-pressed', String(sel === d));
      row.onclick = () => select(d);
      row.onmouseenter = () => setHover(d); row.onmouseleave = () => setHover(null);
      const body = E('span', 'row-body');
      const t1 = E('span', 'row-title'); t1.append(document.createTextNode(short(nm)), E('span', 'badge k-' + kind, STATE_TXT[kind]));
      const sub = E('span', 'row-sub'); if (ln.k) sub.append(E('b', null, ln.k + ' ')); sub.append(document.createTextNode(ln.t));
      body.append(t1, sub);
      const right = E('span', 'row-right');
      right.append(E('span', 'row-meta', nx.at ? `다음 ${day(nx.at, s.now)}` : (m.wake ? '이벤트로' : '')));
      if (m.cards) right.append(E('span', 'row-cards' + (m.urgent ? ' bad' : ''), `할 일 ${m.cards}`));
      row.append(E('span', 'avatar sm k-' + kind, emo), body, right);
      li.append(row); roster.append(li);
    }
    const c = document.getElementById('office-count');
    if (c) {
      c.textContent = '';
      for (const [k, lab] of [['busy', '일하는 중'], ['todo', '결재 대기'], ['blocked', '막힘'], ['idle', '쉬는 중']]) if (cnt[k] || k === 'busy') c.append(E('span', 'badge k-' + k, `${lab} ${cnt[k]}`));
    }
    paint(); renderDetail();
    if (pop && !pop.hidden && hover) { const a = root.querySelector(`.st[data-seat="${hover}"]`); if (a) showPop(hover, a); }
    if (!timer && !reduce) timer = setInterval(() => { if (document.hidden || !cv || !cv.offsetParent) return; frame++; paint(); }, 260);
  }
  if (darkQ && darkQ.addEventListener) darkQ.addEventListener('change', paint);
  window.barunOffice = render;
  window.barunOfficeRepaint = paint;
})();
