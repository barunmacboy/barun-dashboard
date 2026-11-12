// 움직임·마우스 반응 한 곳(2026-11-12 사장님 "인터랙티브한 애니메이션이나 마우스 반응 등을 넣어줘. 시인성과 사용성을 끌어올릴 수 있도록").
// 화면 모듈(*.js)을 고치지 않고 모든 화면에 같이 — CSS는 index.html '움직임' 절, 여기는 그 CSS가 쓰는 값·클래스만 붙인다.
//  · 마우스 빛: 카드·숫자 칸·버튼 위에서 커서를 따라가는 옅은 빛(--mx·--my)
//  · 화면 들어올 때: 'barun:page' → 그 화면 카드가 차례로 떠오름(.enter)
//  · 숫자 바뀜: .stat .v·[data-count] 숫자가 바뀌면 이전 값에서 새 값까지 세며 바뀜
//  · 불러오는 중: '불러오는 중' 글에 도는 고리·반짝임(.ld), 맨 위 얇은 막대(#loadbar), 아직 빈 카드·빈 화면은 뼈대(.sk·.sk-page) — 2026-11-13 사장님
//    "로딩중이면 로딩중 애니메이션 나오게". 받는 중인 요청 수는 transport.js('barun:net')
//  · 휴대폰·터치: 카드 안 세로 스크롤 상자를 접어 '더 보기'(fold — 손가락이 상자에 갇혀 화면이 안 내려가던 것, 같은 날 "스크롤이 안되는 화면")
// 시스템 '동작 줄이기'면 아무것도 움직이지 않는다(CSS도 같은 조건).
(() => {
  const still = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LIGHT = '.card, .stat, .btn, .ac, .st-link, .nav-i, .chip, .st-chip';

  // ── 마우스 빛 ────────────────────────────────────────────────
  let lit = null;
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || still()) return;
    const el = e.target && e.target.closest ? e.target.closest(LIGHT) : null;
    if (lit && lit !== el) lit.classList.remove('lit');
    lit = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
    el.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
    el.classList.add('lit');
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (lit) lit.classList.remove('lit'); lit = null; });

  // ── 화면 들어올 때 ──────────────────────────────────────────
  function enter(name) {
    const sec = document.getElementById('p-' + name);
    if (!sec || still()) return;
    sec.classList.remove('enter');
    void sec.offsetWidth;                                // 다시 재생
    sec.classList.add('enter');
    clearTimeout(enter._t);
    enter._t = setTimeout(() => sec.classList.remove('enter'), 900);
  }
  document.addEventListener('barun:page', (e) => enter(e.detail));

  // ── 숫자 세며 바뀌기 ─────────────────────────────────────────
  const NUM = /^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/s;
  const parse = (t) => {
    const m = NUM.exec(String(t || '').trim());
    if (!m) return null;
    const n = Number(m[2].replace(/,/g, ''));
    return Number.isFinite(n) ? { pre: m[1], n, post: m[3], dec: (m[2].split('.')[1] || '').length, comma: m[2].includes(',') } : null;
  };
  const fmt = (p, v) => p.pre + (p.comma ? v.toLocaleString('ko-KR', { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec }) : v.toFixed(p.dec)) + p.post;
  const last = new WeakMap();
  function count(el) {
    if (el.dataset.counting) return;
    const now = parse(el.textContent), was = last.get(el);
    last.set(el, now);
    if (!now || !was || was.n === now.n || still() || el.children.length) return;   // 안에 다른 요소(작은 단위 글 등)가 있으면 그대로
    const from = was.n, to = now.n, t0 = performance.now(), dur = Math.min(700, 250 + Math.abs(to - from) * 2);
    el.dataset.counting = '1';
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(now, from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
      else { el.textContent = fmt(now, to); delete el.dataset.counting; last.set(el, now); el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 400); }
    };
    requestAnimationFrame(step);
  }

  // ── 불러오는 중: 맨 위 막대 · 빈 카드 뼈대 ──────────────────────
  // 받는 중인 요청이 있고, 첫 자료 전이거나 사람이 방금 화면을 열거나 누른 뒤(6초 안)면 보임 — 20초마다 도는 조용한 갱신에는 안 뜸.
  const bar = document.getElementById('loadbar') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'loadbar' }));
  let net = (window.BarunTransport && window.BarunTransport.pending) || 0, booted = net === 0, touched = performance.now(), barT = 0;
  const wanted = () => net > 0 && (!booted || performance.now() - touched < 6000);
  // 빈 화면 → 화면 뼈대(.sk-page) · 글이 하나도 없는 카드 → 카드 뼈대(.sk) · 제목만 있고 몸이 빈 카드 → 제목 아래 뼈대 줄(.sk-lines, 다 오면 뗌)
  const HEAD = '.card-h, h2, h3, .desc, .sk-lines';
  const things = 'input, select, textarea, img, svg, canvas, iframe';
  const bodyText = (c) => [...c.children].filter((k) => !k.matches(HEAD)).map((k) => k.innerText || '').join('').trim();
  function bones(on) {
    const sec = document.querySelector('main .page:not([hidden])');
    document.querySelectorAll('.sk, .sk-page').forEach((e) => { if (!on || e !== sec && !sec?.contains(e) || (e.innerText || '').trim()) e.classList.remove('sk', 'sk-page'); });
    document.querySelectorAll('.sk-lines').forEach((e) => { const c = e.parentElement; if (!on || !sec?.contains(e) || !c || bodyText(c) || c.querySelector(':scope > :not(' + HEAD + ') :is(' + things + ')')) e.remove(); });
    if (!on || !sec) return;
    if (!(sec.innerText || '').trim()) { sec.classList.add('sk-page'); return; }
    sec.querySelectorAll('.card, .fl-map, .dt-wrap').forEach((c) => {   // 카드 안 카드는 바깥 카드가 맡음(업무 흐름 지도·주문 장부 목록은 카드 안 흰 칸이라 따로)
      if (!c.getClientRects().length || c.querySelector(things) || c.classList.contains('card') && c.parentElement.closest('.card')) return;
      if (!(c.innerText || '').trim()) c.classList.add('sk');
      else if (!bodyText(c) && c.querySelector(':scope > :is(.card-h, h2, h3)') && !c.querySelector(':scope > .sk-lines')) c.append(Object.assign(document.createElement('div'), { className: 'sk-lines' }));
    });
  }
  function netShow() {
    clearTimeout(barT);
    if (wanted()) { barT = setTimeout(() => { if (wanted()) { bar.classList.add('on'); bones(true); } }, 120); return; }
    bar.classList.remove('on'); bones(false);
    if (net === 0) booted = true;
  }
  window.addEventListener('barun:net', (e) => { net = e.detail; netShow(); });
  const touch = () => { touched = performance.now(); };
  document.addEventListener('pointerdown', touch, true); document.addEventListener('keydown', touch, true);
  document.addEventListener('barun:page', () => { touch(); setTimeout(netShow, 0); });
  netShow();

  // ── 휴대폰·터치: 카드 안 세로 스크롤 상자 접기 ─────────────────
  // 일지·알림·활동 표·근거 원문·일 보드 칸처럼 높이를 정해 두고 안에서 넘기던 상자 — 손가락이 그 위에 있으면 화면이 안 내려감.
  // 상자 스크롤을 끄고(.tclip) 아래를 흐리게 + '더 보기'(index.html clipBox). 큰 표(주문 장부)·자세히 창·업무 흐름 칸은 각자 처리.
  const TOUCHY = window.matchMedia('(max-width: 1023px), (pointer: coarse)');
  const BOX = 'ul.log, .md, .bcol ul, #act-table, pre';
  function fold(root) {
    if (!TOUCHY.matches || !window.clipBox || !root.querySelectorAll) return;
    const list = [...root.querySelectorAll(BOX)];
    if (root.matches(BOX)) list.push(root);
    for (const b of list) {
      if (!b.getClientRects().length || b.closest('.dt-wrap, #dt-detail, dialog, .fl-cols') || b.closest('details:not([open])')) continue;   // 접힌 근거 안은 펼칠 때(toggle)
      if (!b.classList.contains('tclip')) {
        if (!/(auto|scroll)/.test(getComputedStyle(b).overflowY) || b.scrollHeight <= b.clientHeight + 4) continue;
        b.classList.add('tclip');
      }
      window.clipBox(b);
    }
  }
  document.addEventListener('toggle', (e) => { if (e.target.open) fold(e.target); }, true);   // 접어 둔 근거를 펼치면 그 안 상자도
  document.addEventListener('barun:page', (e) => setTimeout(() => fold(document.getElementById('p-' + e.detail) || document.body), 60));
  TOUCHY.addEventListener?.('change', () => { if (!TOUCHY.matches) document.querySelectorAll('.tclip').forEach((b) => { b.classList.remove('tclip', 'clip-fade'); b.style.maxHeight = ''; if (b.nextElementSibling?.classList.contains('clip-more') && !b.id) b.nextElementSibling.remove(); }); else fold(document.body); });

  // ── 불러오는 중 반짝임 · 숫자 감시 ─────────────────────────────
  // 한 번에 바뀐 곳을 모아 한 번만 본다. 큰 표(주문 장부 등) 안은 보지 않는다 — 칸 수천 개를 다시 훑지 않게.
  const LOADING = /^\s*불러오는 중/;
  const SKIP = 'table, .dt-wrap, pre, svg';
  function marks(root) {
    if (root.classList && root.classList.contains('ld') && !LOADING.test(root.textContent || '')) root.classList.remove('ld');
    root.querySelectorAll('.ld').forEach((e) => { if (!LOADING.test(e.textContent || '')) e.classList.remove('ld'); });
    if (!(root.textContent || '').includes('불러오는 중')) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (LOADING.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.parentElement && !n.parentElement.closest(SKIP)) n.parentElement.classList.add('ld');
  }
  function scan(root) {
    if (!root || root.nodeType !== 1 || (root.closest && root.closest(SKIP))) return;
    if (root.matches('.stat .v, [data-count]')) count(root);
    root.querySelectorAll('.stat .v, [data-count]').forEach(count);
    marks(root);
    fold(root);
  }
  const mo = new MutationObserver((list) => {
    const todo = new Set();
    for (const m of list) {
      const t = m.type === 'characterData' ? m.target.parentElement : m.target;
      if (!t || (t.dataset && t.dataset.counting) || (t.closest && t.closest(SKIP))) continue;
      todo.add(t);
    }
    if (todo.size > 120) { scan(document.querySelector('main.pages') || document.body); return; }   // 한꺼번에 많이 바뀌면 화면 전체를 한 번
    for (const t of todo) if (![...todo].some((o) => o !== t && o.contains(t))) scan(t);   // 바깥 것만(안쪽은 바깥이 같이 봄)
    if (bar.classList.contains('on') || document.querySelector('.sk, .sk-page')) bones(wanted());   // 새로 생긴 빈 카드엔 뼈대, 자료가 들어온 카드는 뗌
  });
  const start = () => { scan(document.body); mo.observe(document.body, { subtree: true, childList: true, characterData: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  window.barunMotion = { enter, count };
})();
