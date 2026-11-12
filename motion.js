// 움직임·마우스 반응 한 곳(2026-11-12 사장님 "인터랙티브한 애니메이션이나 마우스 반응 등을 넣어줘. 시인성과 사용성을 끌어올릴 수 있도록").
// 화면 모듈(*.js)을 고치지 않고 모든 화면에 같이 — CSS는 index.html '움직임' 절, 여기는 그 CSS가 쓰는 값·클래스만 붙인다.
//  · 마우스 빛: 카드·숫자 칸·버튼 위에서 커서를 따라가는 옅은 빛(--mx·--my)
//  · 화면 들어올 때: 'barun:page' → 그 화면 카드가 차례로 떠오름(.enter)
//  · 숫자 바뀜: .stat .v·[data-count] 숫자가 바뀌면 이전 값에서 새 값까지 세며 바뀜
//  · 불러오는 중: '불러오는 중' 글에 반짝임(.ld)
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
  });
  const start = () => { scan(document.body); mo.observe(document.body, { subtree: true, childList: true, characterData: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  window.barunMotion = { enter, count };
})();
