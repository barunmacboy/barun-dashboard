// 결제 수단 편집 부품 — 카드(별칭·카드사·끝 4자리·해외 수수료·적립 혜택)와 구매처별 결제수단(쓸 카드·사이트에 카드가 저장됐는지)
// (2026-11-14 사장님 "결제수단도 설정 페이지에서 저장되게 하자 에이전트가 그 정보들로 일할 수 있게").
// 설정 > 결제·비용 '결제 수단'과 결제 화면이 같이 씀: window.barunPayEdit.mount(상자). 읽기 GET /api/pay(barun/payment_cards.snapshot —
// 구매처 상태는 barun/pay_methods) · 바꾸기 POST /api/action {action:'pay', op}. 카드번호 전체·보안코드·유효기간은 받지 않는다 — 끝 4자리만.
// 바꾸면 'barun:pay' 알림 → 같은 화면의 다른 부품·결제 화면 숫자가 다시 읽음.
(() => {
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const won = (x) => `${Math.round(Number(x) || 0).toLocaleString('ko-KR')}원`;
  const rng = (r) => `${r.basis === '월 사용액' ? '이번 달 사용액' : '한 번 결제'} ${+r.min_krw ? `${won(r.min_krw)} 이상${r.max_krw ? ` ${won(r.max_krw)}까지` : ''}` : r.max_krw ? `${won(r.max_krw)}까지` : '금액 상관없이'}`;
  const say = (t) => { if (window.toast) window.toast(t); };
  const host = (s) => String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');
  // 구매처 이름: 'prohealth.com'·'prohealth' → koLabel = 프로헬스. 모르는 곳은 그대로
  const shopName = (s) => { const h = host(s); const base = h.replace(/\.(co\.kr|co\.uk|com|net|de|fr|it|eu|jp|kr)$/i, ''); const ko = window.koLabel ? window.koLabel(base) : base; return ko && ko !== base ? ko : h; };
  const SCOPE = { 전체: '모든 결제', 해외: '해외 결제' };
  const scopeName = (s) => SCOPE[s] || (String(s || '').startsWith('구매처:') ? `${shopName(String(s).slice(4))}만` : s);
  const STATE = { ready: ['준비됨', 'ok'], ready_unknown: ['카드 있음', 'ok'], said: ['저장했다고 표시', 'run'], mismatch: ['카드 다름', 'bad'],
    missing: ['저장 카드 없음', 'bad'], unknown: ['모름', ''] };
  const AUTO = ['prohealth', 'amazon', 'chewy'];      // 대신 구매가 결제 화면을 읽는 곳(먼저 보임)

  let css = false;
  function style() {
    if (css) return; css = true;
    const s = E('style'); s.textContent = `
      .pe-note { font-size: 13px; color: var(--sub); line-height: 1.55; background: var(--fill2); border-radius: var(--r-sm); padding: 10px 12px; margin: 0 0 12px; }
      .pe-sub { margin: 18px 0 8px; font-size: 14.5px; font-weight: 700; } .pe-sub:first-of-type { margin-top: 0; }
      .py-card { padding: 16px 0; border-top: 1px solid var(--line); } .py-card:first-child { border-top: 0; padding-top: 4px; }
      .py-h { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .py-h b { font-size: 15px; font-weight: 700; } .py-h .btn { margin-left: auto; }
      .py-m { font-size: 13px; color: var(--sub); margin-top: 4px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; } .py-off { opacity: .55; }
      .py-rules { margin: 8px 0 0; padding: 0; list-style: none; font-size: 13px; display: grid; gap: 4px; }
      .py-rules li { display: flex; gap: 8px; align-items: center; justify-content: space-between; min-height: 40px; padding: 4px 4px 4px 12px; background: var(--fill2); border-radius: var(--r-sm); }
      .py-rules li > span { min-width: 0; overflow-wrap: anywhere; } .py-rules li.none { color: var(--muted); padding: 8px 12px; }
      .py-f { display: grid; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--sub); min-width: 0; }
      .py-f input, .py-f select, .py-sel { box-sizing: border-box; font: inherit; font-size: 14px; font-weight: 400; min-height: 34px; padding: 0 12px; border-radius: var(--r-sm);
        border: 1px solid var(--line); background-color: var(--card); color: var(--ink); min-width: 0; width: 100%; }
      .py-f input:hover, .py-f select:hover, .py-sel:hover { border-color: var(--axis); }
      .py-add { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); } .pe-cards:empty + .py-add { margin-top: 0; padding-top: 0; border-top: 0; }
      .py-add h3 { margin: 0 0 12px; font-size: 14px; font-weight: 700; } .py-add p { margin: 8px 0 0; }
      .py-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, .8fr) minmax(0, 1fr) auto; gap: 12px; align-items: end; }
      .py-grid.rule { grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); } .py-grid.rule > .btn { grid-column: 1 / -1; justify-self: start; }
      .py-more { margin-top: 8px; } .py-more > summary { color: var(--blue-ink); font-weight: 600; } .py-more[open] > summary { margin-bottom: 8px; }
      .py-inline { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; margin-top: 12px; } .py-inline .py-f { flex: 0 1 140px; } .py-inline .py-f.grow { flex: 1 1 180px; }
      .pe-shops { list-style: none; margin: 0; padding: 0; }
      .pe-shops > li { display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, 240px); gap: 6px 12px; align-items: center; padding: 12px 0; border-top: 1px solid var(--line); }
      .pe-shops > li:first-child { border-top: 0; padding-top: 4px; }
      .pe-nm { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 600; font-size: 14px; min-width: 0; } .pe-nm small { font-weight: 400; color: var(--muted); font-size: 12px; }
      .pe-why { grid-column: 1 / -1; font-size: 13px; color: var(--sub); line-height: 1.5; display: flex; gap: 8px 12px; align-items: center; flex-wrap: wrap; }
      .pe-why .btn, .pe-why a { flex: none; }
      .pe-fwd { margin: 12px 0 0; font-size: 13px; color: var(--muted); }
      @media (max-width: 720px) { .py-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .py-grid > .btn { grid-column: 1 / -1; } .pe-shops > li { grid-template-columns: minmax(0, 1fr); } }
      @media (max-width: 420px) { .py-grid { grid-template-columns: minmax(0, 1fr); } }`;
    document.head.append(s);
  }

  // 확인 창 없이 지우는 버튼은 두 번 누르기(3초 안에 한 번 더)
  function twice(label, fn) {
    const x = E('button', 'btn xs ghost', label); x.type = 'button'; let armed = 0;
    x.onclick = () => {
      if (armed) { clearTimeout(armed); armed = 0; fn(x); return; }
      x.textContent = '한 번 더 누르면 지워요'; x.className = 'btn xs danger';
      armed = setTimeout(() => { armed = 0; x.textContent = label; x.className = 'btn xs ghost'; }, 3000);
    };
    return x;
  }

  function mount(box) {
    style();
    let D = null, extra = [];
    const post = async (body, b) => {
      if (b) b.disabled = true;
      try {
        const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pay', ...body }) });
        const j = await r.json().catch(() => ({ ok: false, msg: '응답을 읽지 못했어요. 목록에 반영됐는지 확인해 주세요.' }));
        say(j.msg || (j.ok ? '저장했어요.' : '저장하지 못했어요. 다시 눌러 주세요.'));
        document.dispatchEvent(new CustomEvent('barun:pay'));
        return j;
      } catch (e) { if (e.message !== '로그인 필요') say('보내지 못했어요. 연결을 확인하고 다시 눌러 주세요.'); return null; } finally { if (b) b.disabled = false; }
    };

    function ruleForm(cd) {
      const det = E('details', 'py-more'); det.append(E('summary', '', '적립 혜택 추가'));
      const f = E('div', 'py-grid rule');
      const field = (label, el) => { const l = E('label', 'py-f', label); l.append(el); return l; };
      const basis = E('select'); for (const b of D.basis) basis.append(new Option(b, b));
      const mn = E('input'); mn.placeholder = '예: 300000'; mn.inputMode = 'numeric';
      const mx = E('input'); mx.placeholder = '비우면 끝 없음'; mx.inputMode = 'numeric';
      const pct = E('input'); pct.placeholder = '예: 2'; pct.inputMode = 'decimal';
      const cap = E('input'); cap.placeholder = '비우면 없음'; cap.inputMode = 'numeric';
      const scope = E('select'); for (const s of ['전체', '해외', ...D.shops.map((x) => '구매처:' + x)]) scope.append(new Option(scopeName(s), s));
      const b = E('button', 'btn sm weak', '혜택 추가'); b.type = 'button';
      const num = (e) => Number(String(e.value).replace(/[^\d.]/g, '')) || 0;
      b.onclick = () => post({ op: 'reward_save', card: cd.id, basis: basis.value, min_krw: num(mn), max_krw: num(mx), pct: num(pct), cap_krw: num(cap), scope: scope.value }, b);
      f.append(field('기준', basis), field('이상(원)', mn), field('까지(원)', mx), field('적립(%)', pct), field('월 한도(원)', cap), field('적용 범위', scope), b);
      det.append(f);
      return det;
    }

    function cardRow(cd) {
      const d = E('div', 'py-card' + (cd.active ? '' : ' py-off'));
      const h = E('div', 'py-h');
      h.append(E('b', '', cd.name), E('span', 'badge', `끝 ${cd.last4}`));
      if (!cd.active) h.append(E('span', 'badge', '꺼짐'));
      const meta = [cd.issuer, cd.fx_fee_pct ? `해외 수수료 ${cd.fx_fee_pct}%` : ''].filter(Boolean).join(' · ');
      if (meta) h.append(E('span', 'muted small', meta));
      const t = E('button', 'btn sm ghost', cd.active ? '끄기' : '켜기'); t.type = 'button'; t.title = cd.active ? '끄면 AI가 이 카드를 고르지 않아요' : '다시 켜면 AI가 이 카드를 골라요';
      t.onclick = () => post({ op: cd.active ? 'card_off' : 'card_on', id: cd.id }, t);
      h.append(t);
      d.append(h, E('div', 'py-m', `이번 달 AI 결제 ${cd.month.n}건 · ${won(cd.month.krw)} · 예상 적립 ${won(cd.month.reward)}`));
      const ul = E('ul', 'py-rules');
      if (!cd.rewards.length) ul.append(E('li', 'none', '적립 혜택이 아직 없어요. 아래 [적립 혜택 추가]에서 넣어 주세요.'));
      for (const r of cd.rewards) {
        const li = E('li');
        li.append(E('span', '', `${rng(r)} → ${r.pct}%${r.cap_krw ? ` (월 ${won(r.cap_krw)}까지, 이번 달 ${won(r.used)})` : ''} · ${scopeName(r.scope)}`));
        li.append(twice('지우기', (x) => post({ op: 'reward_del', id: r.id }, x))); ul.append(li);
      }
      d.append(ul, ruleForm(cd));
      return d;
    }

    function addForm() {
      const w = E('div', 'py-add'); w.append(E('h3', '', '카드 추가'));
      const g = E('div', 'py-grid');
      const field = (label, attrs) => { const l = E('label', 'py-f', label); const i = E('input'); Object.assign(i, attrs, { autocomplete: 'off' }); l.append(i); g.append(l); return i; };
      const name = field('별칭', { placeholder: '예: 신한 해외', maxLength: 40 });
      const issuer = field('카드사', { placeholder: '예: 신한카드', maxLength: 30 });
      const last4 = field('끝 4자리', { placeholder: '1234', inputMode: 'numeric', maxLength: 4 });
      const fee = field('해외 결제 수수료(%)', { placeholder: '예: 1.2', inputMode: 'decimal' });
      const b = E('button', 'btn sm primary', '카드 추가'); b.type = 'button';
      b.onclick = () => {
        const l4 = String(last4.value || '').trim();
        if (!/^\d{4}$/.test(l4)) { say('카드 끝 4자리 숫자를 적어 주세요.'); last4.focus(); return; }
        post({ op: 'card_save', name: name.value, issuer: issuer.value, last4: l4, fx_fee_pct: fee.value || 0 }, b).then((j) => { if (j && j.ok) for (const i of [name, issuer, last4, fee]) i.value = ''; });
      };
      g.append(b);
      w.append(g, E('p', 'muted small', '카드번호 전체·보안코드·유효기간은 받지 않아요. 끝 4자리만 저장해요.'));
      return w;
    }

    function shopRow(m) {
      const li = E('li');
      const nm = E('div', 'pe-nm'); const n = E('span', null, shopName(m.shop));
      nm.append(n); if (shopName(m.shop).toLowerCase() !== host(m.shop).toLowerCase()) nm.append(E('small', '', host(m.shop)));
      const [lab, cls] = STATE[m.state] || [m.state, ''];
      nm.append(E('span', 'badge ' + cls, lab));
      const sel = E('select', 'py-sel'); sel.setAttribute('aria-label', `${shopName(m.shop)}에서 쓸 카드`);
      sel.append(new Option('자동 — 적립 큰 저장 카드', ''));
      for (const cd of D.cards) if (cd.active) sel.append(new Option(`${cd.name}(끝 ${cd.last4})`, cd.id));
      sel.value = m.card || '';
      sel.onchange = () => post({ op: 'shop_set', shop: m.shop, card: sel.value }, sel);
      const why = E('div', 'pe-why'); why.append(E('span', null, m.why + (m.seen_at ? ` · ${String(m.seen_at).slice(5, 16).replace('T', ' ').replace('-', '/')} 확인` : '')));
      if (!['ready', 'ready_unknown'].includes(m.state)) {
        if (m.url) { const a = E('a', 'more-link', '사이트에서 카드 저장 ›'); a.href = m.url; a.target = '_blank'; a.rel = 'noopener'; why.append(a); }
        const sv = E('button', 'btn xs ' + (m.saved ? 'ghost' : 'weak'), m.saved ? '표시 풀기' : '저장했어요'); sv.type = 'button';
        sv.title = '구매처 사이트에 카드를 저장했으면 눌러 주세요 — 다음 결제 화면에서 확인해요';
        sv.onclick = () => post({ op: 'site_saved', shop: m.shop, on: !m.saved }, sv);
        why.append(sv);
      }
      li.append(nm, sel, why);
      return li;
    }

    function render() {
      box.textContent = '';
      box.append(E('p', 'pe-note', '카드는 구매처 사이트에 사장님이 한 번 저장해 두세요. 여기에는 별칭·카드사·끝 4자리만 적어요. AI는 결제 화면에서 끝 4자리가 같은 저장 카드를 고를 뿐이고, 카드번호를 넣지 않아요.'));
      box.append(E('h3', 'pe-sub', '카드'));
      const cs = E('div', 'pe-cards'); for (const cd of D.cards) cs.append(cardRow(cd));
      box.append(cs, addForm());
      box.append(E('h3', 'pe-sub', '구매처 결제수단'));
      const all = [...new Set([...(D.methods || []).map((m) => m.shop), ...extra])];
      const byShop = Object.fromEntries((D.methods || []).map((m) => [m.shop, m]));
      const row = (s) => byShop[s] || { shop: s, state: 'unknown', why: '아직 결제 화면을 못 봤어요', url: '', card: D.shop_cards[s] || '', saved: false };
      const main = all.filter((s) => AUTO.includes(s)), rest = all.filter((s) => !AUTO.includes(s));
      const ul = E('ul', 'pe-shops'); for (const s of main) ul.append(shopRow(row(s))); box.append(ul);
      if (rest.length) {
        const d = E('details', 'py-more'); d.append(E('summary', '', `다른 구매처 ${rest.length}곳`));
        const u2 = E('ul', 'pe-shops'); for (const s of rest) u2.append(shopRow(row(s))); d.append(u2); box.append(d);
      }
      const add = E('div', 'py-inline'), lab = E('label', 'py-f grow', '구매처 추가'), inp = E('input'); inp.placeholder = '도메인(예: iherb.com)'; inp.autocomplete = 'off';
      lab.append(inp); const ab = E('button', 'btn sm', '추가'); ab.type = 'button';
      ab.onclick = () => { const s = host(inp.value); if (s) { extra = [...new Set([...extra, s])]; inp.value = ''; render(); } };
      add.append(lab, ab); box.append(add);
      if ((D.forwarders || []).length) box.append(E('p', 'pe-fwd', `배대지(${D.forwarders.map(shopName).join('·')}) 배송비는 포인트·예치금·마이캐시로 내요 — 카드를 쓰지 않아요.`));
    }

    async function load() {
      try {
        const r = await (window.barunFetch || fetch)('/api/pay');
        if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
        D = await r.json(); render();
      } catch (e) {
        if (e.message !== '로그인 필요' && !D) { box.textContent = ''; box.append(E('div', 'empty', '결제 수단을 읽지 못했어요. 잠시 뒤 다시 열어 주세요.')); }
      }
    }
    document.addEventListener('barun:pay', load);
    load();
    return { reload: load };
  }

  window.barunPayEdit = { mount };
})();
