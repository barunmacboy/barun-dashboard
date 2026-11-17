// 자동화 켜고 끄기 — 흩어진 자동화 스위치를 업무 갈래별로 한 화면에, 스위치마다 무엇을 하나요·예시(2026-11-18 사장님 "자동화 설정 시트나 메뉴를
// 하나 만들어서 토글로 뭐 어떤 부분 자동화 켜고끌지 바로바로 설정할 수 있게 해보자 · 해당 자동화 토글이 예를 들면 어떤 작업인지도 이해하기 편하게").
// 읽기: GET /api/switches(barun/views/switches.snapshot — 원본은 설정 bool·pay.auto_pay_shops·예약 AI 업무 멈춤, 새 스위치를 만들지 않음).
// 바꾸기: 설정 화면과 같은 POST /api/action {action:'settings', op:'set'(bool)·'shop_pay'(구매처 하나)·'pause'·'resume'(AI 회차)}.
// 바깥에 실제로 쓰는 스위치(risk)는 4초 안에 한 번 더 눌러야 바뀜(설정 화면과 같은 방식 — 브라우저 확인 창은 쓰지 않음). 잠긴 스위치는 이유만 보여 줌.
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const when = (at) => String(at || '').slice(5, 16).replace('T', ' ');
  let D = null, busy = false, q = '';
  const armed = new Map();          // 스위치 id → 첫 번째 누른 때(위험 스위치 두 번 누르기)

  function install() {
    const sec = $('p-switches'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      #p-switches { display: grid; gap: 14px; }
      .sw-top { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
      .sw-top input[type=search] { font: inherit; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--ink); flex: 1 1 240px; min-width: 0; }
      .sw-sum { font-size: 13px; color: var(--sub); }
      .sw-list { list-style: none; margin: 4px 0 0; padding: 0; display: grid; }
      .sw-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 16px; padding: 14px 0; border-top: 1px solid var(--line); align-items: start; }
      .sw-list .sw-row:first-child { border-top: 0; }
      .sw-row h3 { margin: 0; font-size: 15px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
      .sw-what { margin: 4px 0 0; font-size: 13.5px; color: var(--sub); line-height: 1.5; }
      .sw-ex { margin: 6px 0 0; font-size: 13px; color: var(--ink); background: var(--fill2, var(--fill)); border-radius: 8px; padding: 6px 10px; line-height: 1.5; }
      .sw-ex b { color: var(--muted); font-weight: 600; margin-right: 4px; }
      .sw-meta { margin: 6px 0 0; font-size: 12px; color: var(--muted); }
      .sw-lock { margin: 6px 0 0; font-size: 13px; color: var(--orange-ink); }
      .sw-side { display: grid; justify-items: end; gap: 4px; padding-top: 2px; }
      .sw-state { font-size: 12px; color: var(--muted); white-space: nowrap; }
      .sw-msg { font-size: 12px; color: var(--sub); max-width: 220px; text-align: right; }
      .sw-msg.bad { color: var(--red-ink); }
      .sw { position: relative; width: 48px; height: 28px; border-radius: 999px; border: 0; padding: 0; cursor: pointer; flex: none;
        background: var(--line); transition: background-color .18s var(--ease, ease); }
      .sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff;
        box-shadow: 0 1px 3px rgba(16, 24, 40, .25); transition: transform .18s var(--ease, ease); }
      .sw[aria-checked="true"] { background: var(--blue); }
      .sw[aria-checked="true"]::after { transform: translateX(20px); }
      .sw:disabled { cursor: not-allowed; opacity: .45; }
      .sw.armed { box-shadow: 0 0 0 3px color-mix(in srgb, var(--orange) 45%, transparent); }
      .sw:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
      @media (max-width: 600px) { .sw-row { grid-template-columns: minmax(0, 1fr); } .sw-side { grid-template-columns: auto auto; justify-content: start; justify-items: start; align-items: center; }
        .sw-msg { text-align: left; max-width: none; grid-column: 1 / -1; } }`;
    document.head.append(css);
    const hero = E('div', 'card hero');
    hero.append(Object.assign(E('h2', '', '자동화 켜고 끄기'), { id: 'sw-title' }), E('p', 'lead', 'AI가 스스로 하는 일을 업무별로 켜고 꺼요. 스위치마다 무엇을 하는지와 실제 예시를 적어 뒀어요.'));
    const top = E('div', 'sw-top'), s = E('input'); s.type = 'search'; s.placeholder = '찾기 (예: 아마존, 반품, 문의)'; s.id = 'sw-q';
    s.oninput = () => { q = s.value.trim().toLowerCase(); if (D) render(D); };
    top.append(s, Object.assign(E('span', 'sw-sum'), { id: 'sw-sum' }));
    hero.append(top);
    sec.append(hero, Object.assign(E('div'), { id: 'sw-groups', style: 'display:grid;gap:14px' }));
    document.addEventListener('barun:page', (e) => { if (e.detail === 'switches') load(); });
    if (!sec.hidden) load();
    return true;
  }

  async function post(it, on, btn, msg) {
    const body = it.type === 'setting' ? { op: 'set', key: it.key, value: it.invert ? !on : on }
      : it.type === 'shop' ? { op: 'shop_pay', shop: it.shop, on } : { op: on ? 'resume' : 'pause', job: it.job };
    btn.disabled = true;
    try {
      const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'settings', ...body }) });
      const j = await r.json();
      msg.textContent = j.msg || ''; msg.className = 'sw-msg' + (j.ok ? '' : ' bad');
      if (window.toast) window.toast(j.msg);
      if (j.ok) setTimeout(load, 700);
    } catch (e) { msg.textContent = '바꾸지 못했어요. 연결을 확인해 주세요'; msg.className = 'sw-msg bad'; }
    finally { btn.disabled = !!it.locked; }
  }

  function row(it) {
    const li = E('li', 'sw-row'), main = E('div'), side = E('div', 'sw-side');
    const h = E('h3'); h.append(E('span', '', it.label));
    if (it.risk) h.append(E('span', 'badge warn', '바깥에 실제로 씀'));
    if (it.locked) h.append(E('span', 'badge', '잠김'));
    main.append(h, E('p', 'sw-what', it.what));
    if (it.example) { const ex = E('p', 'sw-ex'); ex.append(E('b', '', '예시'), document.createTextNode(it.example.replace(/^예:\s*/, ''))); main.append(ex); }
    if (it.lock_why) main.append(E('p', 'sw-lock', it.lock_why));
    if (it.by || it.at) { const by = String(it.by || '—'), cut = by.length > 36 ? by.slice(0, 36) + '…' : by;   // 바꾼 이에 붙은 이유가 길면 잘라서(전체는 마우스를 올리면)
      main.append(Object.assign(E('p', 'sw-meta', `마지막으로 바꾼 이 ${cut}${it.at ? ' · ' + when(it.at) : ''}`), { title: by })); }
    const btn = E('button', 'sw'); btn.type = 'button'; btn.setAttribute('role', 'switch'); btn.setAttribute('aria-checked', String(!!it.on));
    btn.setAttribute('aria-label', `${it.label} ${it.on ? '켜짐' : '꺼짐'}`); btn.disabled = !!it.locked;
    const state = E('span', 'sw-state', it.locked ? '켤 수 없음' : it.on ? '켜짐' : '꺼짐'), msg = E('div', 'sw-msg');
    btn.onclick = () => {
      const on = !it.on;
      if (it.risk && Date.now() - (armed.get(it.id) || 0) > 4000) {      // 바깥에 쓰는 스위치 — 4초 안에 한 번 더
        armed.set(it.id, Date.now()); btn.classList.add('armed');
        msg.className = 'sw-msg bad'; msg.textContent = `바깥에 실제로 쓰는 스위치예요. ${on ? '켜려면' : '끄려면'} 4초 안에 한 번 더 눌러 주세요`;
        setTimeout(() => { btn.classList.remove('armed'); if (Date.now() - (armed.get(it.id) || 0) >= 4000 && msg.classList.contains('bad')) msg.textContent = ''; }, 4100);
        return;
      }
      armed.delete(it.id); btn.classList.remove('armed');
      post(it, on, btn, msg);
    };
    side.append(btn, state, msg);
    li.append(main, side);
    return li;
  }

  function render(d) {
    D = d;
    const box = $('sw-groups'); if (!box) return;
    box.textContent = '';
    $('sw-sum').textContent = `스위치 ${d.total}개 중 ${d.on}개 켜짐`;
    const hit = (it) => !q || [it.label, it.what, it.example, it.group].join(' ').toLowerCase().includes(q);
    let shown = 0;
    for (const g of d.groups) {
      const its = g.items.filter(hit);
      if (!its.length) continue;
      shown += its.length;
      const c = E('section', 'card'); c.dataset.group = g.name;
      const h = E('div', 'card-h'); h.append(E('h2', '', g.name), E('span', 'desc', `${its.filter((i) => i.on).length}/${its.length} 켜짐`));
      c.append(h);
      if (g.desc) c.append(E('p', 'sw-what', g.desc));
      const ul = E('ul', 'sw-list'); its.forEach((it) => ul.append(row(it))); c.append(ul);
      box.append(c);
    }
    if (!shown) box.append(E('div', 'card empty', '찾는 스위치가 없어요.'));
  }

  async function load() {
    if (busy) return; busy = true;
    try { const r = await (window.barunFetch || fetch)('/api/switches'); if (r.ok) render(await r.json()); }
    catch (e) { /* 토큰 창은 barunFetch가 띄움 */ } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
