// 결제 화면 — 카드 목록·적립 혜택·구매처별 카드·AI가 쓴 현황·추천 카드(2026-11-06 사장님: "현황판에 결제 섹션… 각 카드별 AI가 사용한 현황…
// 적립 혜택(얼마 이상 얼마까지 몇%)… 어떤 카드로 결제할지 선택… 구매처별로도 카드를 지정").
// 읽기: GET /api/pay(barun/payment_cards.snapshot) · 바꾸기: POST /api/action {action:'pay', op, …}. 카드번호는 받지 않는다 — 끝 4자리만.
// 자리: index.html에 미리 있는 화면(#p-pay)을 채운다(보임·숨김은 'barun:page' 이벤트).
// 2026-11-12 리뉴얼: 화면 글 해요체, 카드 추가·적립 혜택은 이름 붙은 칸, 구매처 이름은 window.koLabel, 결제 상태는 한국어 배지, 휴대폰에서 최근 결제는 카드 모양.
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const won = (x) => `${Math.round(Number(x) || 0).toLocaleString('ko-KR')}원`;
  const rng = (r) => `${r.basis === '월 사용액' ? '이번 달 사용액' : '한 번 결제'} ${+r.min_krw ? `${won(r.min_krw)} 이상${r.max_krw ? ` ${won(r.max_krw)}까지` : ''}` : r.max_krw ? `${won(r.max_krw)}까지` : '금액 상관없이'}`;
  const say = (t) => { if (window.toast) window.toast(t); };
  const host = (s) => String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');
  // 구매처 이름: 'prohealth.com' → koLabel('prohealth') = 프로헬스. 모르는 곳은 도메인 그대로
  const shopName = (s) => { const h = host(s); const base = h.replace(/\.(co\.kr|co\.uk|com|net|de|fr|it|eu|jp|kr)$/i, ''); const ko = window.koLabel ? window.koLabel(base) : base; return ko && ko !== base ? ko : h; };
  const SCOPE = { 전체: '모든 결제', 해외: '해외 결제' };
  const scopeName = (s) => SCOPE[s] || (String(s || '').startsWith('구매처:') ? `${shopName(String(s).slice(4))}만` : s);
  const PST = { paid: ['결제됨', 'ok'], ready: ['확인 중', 'run'], blocked: ['멈춤', 'bad'], failed: ['실패', 'bad'] };   // 결제 관문 상태(pricing/paygate)
  const when = (at) => String(at || '').slice(5, 16).replace('T', ' ').replace('-', '/');
  let D = null, timer = 0, busy = false;

  function install() {
    const sec = $('p-pay'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      #p-pay .card { scroll-margin-top: calc(var(--bar-h) + 12px); }
      #p-pay div.stat { cursor: default; }
      @media (hover: hover) { #p-pay div.stat:hover { transform: none; background-color: var(--fill2); box-shadow: inset 0 0 0 1px var(--line); } }
      @media (hover: hover) and (prefers-color-scheme: dark) { #p-pay div.stat:hover { box-shadow: none; } }
      .py-cta { margin-top: 4px; } #py-stats[hidden], #py-cta[hidden] { display: none; }
      .py-card { padding: 16px 0; border-top: 1px solid var(--line); } .py-card:first-child { border-top: 0; padding-top: 4px; }
      .py-h { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .py-h b { font-size: 15px; font-weight: 700; } .py-h .btn { margin-left: auto; }
      .py-m { font-size: 13px; color: var(--sub); margin-top: 4px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; } .py-off { opacity: .55; }
      .py-rules { margin: 8px 0 0; padding: 0; list-style: none; font-size: 13px; display: grid; gap: 4px; }
      .py-rules li { display: flex; gap: 8px; align-items: center; justify-content: space-between; min-height: 40px; padding: 4px 4px 4px 12px; background: var(--fill2); border-radius: var(--r-sm); }
      .py-rules li > span { min-width: 0; overflow-wrap: anywhere; } .py-rules li.none { color: var(--muted); padding: 8px 12px; }
      .py-f { display: grid; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--sub); min-width: 0; }
      .py-f input, .py-f select, .py-sel { box-sizing: border-box; font: inherit; font-size: 14px; font-weight: 400; min-height: 34px; padding: 0 12px; border-radius: var(--r-sm);
        border: 1px solid var(--line); background-color: var(--card); color: var(--ink); min-width: 0; width: 100%; }
      .py-f select, .py-sel { -webkit-appearance: none; appearance: none; padding-right: 32px; cursor: pointer; text-overflow: ellipsis;
        background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
        background-position: right 16px center, right 11px center; background-size: 5px 5px; background-repeat: no-repeat; }
      .py-f input:hover, .py-f select:hover, .py-sel:hover { border-color: var(--axis); }
      .py-add { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); } #py-cards:empty + .py-add { margin-top: 0; padding-top: 0; border-top: 0; }
      .py-add h3 { margin: 0 0 12px; font-size: 14px; font-weight: 700; } .py-add p { margin: 8px 0 0; }
      .py-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, .8fr) minmax(0, 1fr) auto; gap: 12px; align-items: end; }
      .py-grid.rule { grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); } .py-grid.rule > .btn { grid-column: 1 / -1; justify-self: start; }
      .py-more { margin-top: 8px; } .py-more > summary { color: var(--blue-ink); font-weight: 600; } .py-more[open] > summary { margin-bottom: 8px; }
      .py-inline { display: flex; gap: 12px; align-items: end; flex-wrap: wrap; } .py-inline .py-f { flex: 0 1 140px; } .py-inline .py-f.grow { flex: 1 1 180px; }
      .py-inline + .py-inline, .py-shops + .py-inline { margin-top: 12px; }
      .py-cols { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 14px; align-items: start; }
      .py-shops { list-style: none; margin: 0; padding: 0; }
      .py-shops li { display: flex; gap: 8px 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 8px 0; border-top: 1px solid var(--line); }
      .py-shops li:first-child { border-top: 0; padding-top: 0; }
      .py-shops .py-nm { min-width: 0; font-weight: 600; font-size: 14px; overflow-wrap: anywhere; } .py-shops .py-nm small { display: block; font-weight: 400; color: var(--muted); font-size: 12px; }
      .py-shops .py-sel { flex: 0 1 260px; min-width: 200px; width: auto; }
      .py-pick { margin-top: 12px; font-size: 14px; } .py-pick:empty { display: none; }
      .py-pick .py-box { padding: 12px 16px; border-radius: var(--r-sm); background: var(--fill2); }
      .py-pick-top { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; } .py-pick-top b { font-size: 15px; }
      .py-others { margin: 8px 0 0; padding: 8px 0 0; list-style: none; border-top: 1px solid var(--line); font-size: 13px; color: var(--sub); display: grid; gap: 4px; }
      .py-tbl-wrap { overflow-x: auto; }
      .py-tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
      .py-tbl th, .py-tbl td { padding: 8px 16px 8px 0; border-top: 1px solid var(--line); text-align: left; vertical-align: middle; }
      .py-tbl th:last-child, .py-tbl td:last-child { padding-right: 0; }
      .py-tbl thead th { border-top: 0; padding-top: 0; color: var(--muted); font-weight: 600; font-size: 12.5px; white-space: nowrap; }
      .py-tbl .r { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .py-tbl .py-when { white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--sub); } .py-tbl td.py-shop { font-weight: 600; }
      .py-tbl .dash { color: var(--muted); }
      @media (max-width: 1100px) { .py-cols { grid-template-columns: minmax(0, 1fr); } }
      @media (max-width: 720px) { .py-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .py-grid > .btn { grid-column: 1 / -1; } }
      @media (max-width: 640px) {
        .py-tbl thead { display: none; }
        .py-tbl, .py-tbl tbody { display: block; }
        .py-tbl tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "shop amt" "when st" "card rw"; gap: 4px 12px; padding: 12px 0; border-top: 1px solid var(--line); }
        .py-tbl tbody tr:first-child { border-top: 0; padding-top: 0; }
        .py-tbl td { padding: 0; border: 0; min-width: 0; }
        .py-tbl td.py-shop { grid-area: shop; overflow-wrap: anywhere; } .py-tbl td.py-amt { grid-area: amt; font-weight: 700; }
        .py-tbl td.py-when { grid-area: when; font-size: 12.5px; } .py-tbl td.py-st { grid-area: st; text-align: right; }
        .py-tbl td.py-cd { grid-area: card; font-size: 12.5px; color: var(--sub); overflow-wrap: anywhere; } .py-tbl td.py-rw { grid-area: rw; font-size: 12.5px; }
        .py-tbl td.py-rw::before { content: '적립 '; color: var(--muted); } .py-tbl td.py-rw.dash { display: none; }
        .py-shops li { flex-wrap: nowrap; } .py-shops .py-sel { flex: 0 0 176px; min-width: 0; }
      }
      @media (max-width: 420px) { .py-grid { grid-template-columns: minmax(0, 1fr); } }
      @media (max-width: 600px) { .py-f input, .py-f select, .py-sel { font-size: 16px; } }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero"><h2 id="py-title">불러오는 중</h2><p class="lead" id="py-lead"></p><div class="stats" id="py-stats"></div><div class="py-cta" id="py-cta" hidden></div></div>
      <div class="card"><div class="card-h"><h2>카드</h2><span class="desc">카드마다 이번 달 AI 결제와 적립 혜택이에요.</span></div><div id="py-cards"></div>
        <div class="py-add" id="py-add"><h3>카드 추가</h3>
          <div class="py-grid">
            <label class="py-f">별칭<input id="py-name" placeholder="예: 신한 해외" maxlength="40" autocomplete="off"></label>
            <label class="py-f">카드사<input id="py-issuer" placeholder="예: 신한카드" maxlength="30" autocomplete="off"></label>
            <label class="py-f">끝 4자리<input id="py-last4" placeholder="1234" inputmode="numeric" maxlength="4" pattern="\\d{4}" autocomplete="off"></label>
            <label class="py-f">해외 결제 수수료(%)<input id="py-fee" placeholder="예: 1.2" inputmode="decimal" autocomplete="off"></label>
            <button class="btn sm primary" type="button" id="py-add-b">카드 추가</button>
          </div>
          <p class="muted small">카드번호 전체는 받지 않아요. 끝 4자리만 저장해요.</p></div></div>
      <div class="py-cols">
        <div class="card"><div class="card-h"><h2>구매처별 카드</h2><span class="desc">구매처에 카드를 정하면 늘 그 카드로 결제해요. 비워 두면 적립이 가장 큰 카드를 써요.</span></div><div id="py-shops"></div>
          <div class="py-inline"><label class="py-f grow">구매처 추가<input id="py-shop-new" placeholder="도메인(예: prohealth.com)" autocomplete="off"></label><button class="btn sm" type="button" id="py-shop-add">추가</button></div></div>
        <div class="card"><div class="card-h"><h2>결제 카드 미리 보기</h2><span class="desc">구매처와 금액을 넣으면 AI가 고를 카드를 보여 줘요.</span></div>
          <div class="py-inline"><label class="py-f grow">구매처<input id="py-q-shop" list="py-shop-list" placeholder="예: prohealth.com" autocomplete="off"></label>
            <label class="py-f">금액(원)<input id="py-q-krw" placeholder="예: 120000" inputmode="numeric" autocomplete="off"></label>
            <button class="btn sm primary" type="button" id="py-q-b">카드 보기</button></div>
          <datalist id="py-shop-list"></datalist>
          <div class="py-pick" id="py-q-out" aria-live="polite"></div></div>
      </div>
      <div class="card"><div class="card-h"><h2>최근 AI 결제</h2><span class="desc">AI가 낸 결제 기록과 쓴 카드, 예상 적립이에요.</span></div><div id="py-recent"></div></div>`;
    $('py-add-b').onclick = () => {
      const last4 = String($('py-last4').value || '').trim();
      if (!/^\d{4}$/.test(last4)) { say('카드 끝 4자리 숫자를 적어 주세요.'); return; }
      post({ op: 'card_save', name: $('py-name').value, issuer: $('py-issuer').value, last4, fx_fee_pct: $('py-fee').value || 0 }, $('py-add-b'))
        .then((j) => { if (j && j.ok) for (const id of ['py-name', 'py-issuer', 'py-last4', 'py-fee']) $(id).value = ''; });
    };
    $('py-shop-add').onclick = () => { const s = $('py-shop-new').value.trim(); if (s && D) { D.extra = [...(D.extra || []), s]; $('py-shop-new').value = ''; render(D); } };
    $('py-q-b').onclick = pickNow;
    for (const id of ['py-q-shop', 'py-q-krw']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); pickNow(); } });
    document.addEventListener('barun:page', (e) => { if (e.detail === 'pay') { load(); start(); } else stop(); });
    if (!sec.hidden) start();
    return true;
  }

  const start = () => { stop(); load(); timer = setInterval(() => { if (!document.hidden && !$('p-pay').hidden) load(); }, 60000); };
  const stop = () => { if (timer) clearInterval(timer); timer = 0; };
  const stat = (k, v, d, cls) => { const s = E('div', 'stat' + (cls ? ' ' + cls : '')); s.append(E('div', 'k', k), E('div', 'v', v), E('div', 'd', d || '')); return s; };

  async function post(body, b) {
    if (b) b.disabled = true;
    try {
      const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pay', ...body }) });
      const j = await r.json().catch(() => ({ ok: false, msg: '응답을 읽지 못했어요. 목록에 반영됐는지 확인해 주세요.' }));
      say(j.msg || (j.ok ? '저장했어요.' : '저장하지 못했어요. 다시 눌러 주세요.'));
      load(); return j;
    } catch (e) { if (e.message !== '로그인 필요') say('보내지 못했어요. 연결을 확인하고 다시 눌러 주세요.'); return null; } finally { if (b) b.disabled = false; }
  }

  async function pickNow() {
    const out = $('py-q-out'); out.textContent = '고르는 중…';
    try {
      const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pay', op: 'pick', shop: $('py-q-shop').value, krw: Number(String($('py-q-krw').value).replace(/[^\d]/g, '')) || 0 }) });
      const j = await r.json();
      if (!j.ok) { out.textContent = j.msg; return; }
      let p; try { p = JSON.parse(j.msg); } catch (e) { out.textContent = j.msg; return; }
      out.innerHTML = '';
      const box = E('div', 'py-box'); const top = E('div', 'py-pick-top');
      top.append(E('b', '', p.name), E('span', 'badge run', `끝 ${p.last4}`)); box.append(top);
      if (p.why) box.append(E('div', 'py-m', p.why));
      box.append(E('div', 'py-m', `예상 적립 ${won(p.reward)} · 해외 수수료 ${won(p.fee)}`));
      if ((p.others || []).length) {
        const ul = E('ul', 'py-others');
        for (const o of p.others) ul.append(E('li', '', `${o.name}(끝 ${o.last4}) · 적립 ${won(o.reward)} · 수수료 ${won(o.fee)}`));
        box.append(ul);
      }
      out.append(box);
    } catch (e) { out.textContent = e.message === '로그인 필요' ? '' : '카드를 고르지 못했어요. 다시 눌러 주세요.'; }
  }

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

  function shopRow(shop) {
    const li = E('li');
    const nm = E('span', 'py-nm', shopName(shop)); if (shopName(shop).toLowerCase() !== host(shop).toLowerCase()) nm.append(E('small', '', host(shop)));
    const sel = E('select', 'py-sel'); sel.append(new Option('자동(적립 큰 카드)', ''));
    for (const cd of D.cards) if (cd.active) sel.append(new Option(`${cd.name}(끝 ${cd.last4})`, cd.id));
    sel.value = D.shop_cards[shop] || '';
    sel.onchange = () => post({ op: 'shop_set', shop, card: sel.value }, sel);
    li.append(nm, sel);
    return li;
  }

  function render(d) {
    D = d;
    const tot = d.cards.reduce((a, c) => ({ n: a.n + c.month.n, krw: a.krw + c.month.krw, rw: a.rw + c.month.reward }), { n: 0, krw: 0, rw: 0 });
    const on = d.cards.filter((c) => c.active).length;
    const st = $('py-stats'); st.innerHTML = '';
    const cta = $('py-cta'); cta.innerHTML = '';
    if (d.cards.length) {
      $('py-title').textContent = `${+d.month.slice(5)}월 AI 카드 결제 ${tot.n}건 · ${won(tot.krw)}`;
      $('py-lead').textContent = 'AI가 결제할 때는 구매처에 정한 카드를 쓰고, 정하지 않은 구매처는 적립이 가장 큰 카드로 내요. 카드번호는 끝 4자리만 저장해요.';
      st.hidden = false; cta.hidden = true;
      st.append(stat('쓰는 카드', `${on}장`, `전체 ${d.cards.length}장`, on ? 'ok' : 'warn'), stat('이번 달 결제', won(tot.krw), `${tot.n}건`),
        stat('예상 적립', won(tot.rw), '적립 혜택으로 계산', tot.rw ? 'ok' : ''), stat('구매처 지정', `${Object.keys(d.shop_cards).length}곳`, '나머지는 적립 큰 카드'));
    } else {   // 카드가 없으면 0만 네 칸 대신 할 일 하나(2026-11-12 화면 점검)
      $('py-title').textContent = '등록한 카드가 없어요';
      $('py-lead').textContent = 'AI가 결제할 카드를 먼저 추가해 주세요. 카드번호 전체는 받지 않고 끝 4자리만 저장해요.';
      st.hidden = true; cta.hidden = false;
      const b = E('button', 'btn primary', '카드 추가하기'); b.type = 'button';
      b.onclick = () => { $('py-add').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('py-name').focus({ preventScroll: true }); };
      cta.append(b);
    }
    const cs = $('py-cards'); cs.innerHTML = '';
    for (const cd of d.cards) cs.append(cardRow(cd));
    const shops = [...new Set([...d.shops, ...(d.extra || [])])];
    const ul = E('ul', 'py-shops');
    for (const s of shops) ul.append(shopRow(s));
    $('py-shops').innerHTML = ''; $('py-shops').append(shops.length ? ul : E('div', 'empty', '아직 결제한 구매처가 없어요. 아래에 도메인을 적고 [추가]를 눌러 주세요.'));
    const dl = $('py-shop-list'); dl.innerHTML = ''; for (const s of shops) { const o = E('option'); o.value = s; dl.append(o); }
    const name = Object.fromEntries(d.cards.map((c) => [c.id, `${c.name}(끝 ${c.last4})`]));
    const anyRw = d.recent.some((p) => p.reward_krw);   // 예상 적립이 한 줄도 없으면 칸을 숨김
    const rt = E('table', 'py-tbl');
    rt.innerHTML = `<thead><tr><th>시각</th><th>구매처</th><th class="r">금액</th><th>상태</th><th>카드</th>${anyRw ? '<th class="r">예상 적립</th>' : ''}</tr></thead>`;
    const tb = E('tbody');
    for (const p of d.recent) {
      const tr = E('tr');
      const [lab, cls] = PST[p.status] || [p.status ? (window.koLabel ? window.koLabel(p.status) : p.status) : '', ''];
      const stc = E('td', 'py-st'); if (lab) stc.append(E('span', 'badge ' + cls, lab));
      tr.append(E('td', 'py-when', when(p.at)), E('td', 'py-shop', p.shop ? shopName(p.shop) : '—'), E('td', 'r py-amt', p.krw ? won(p.krw) : '—'), stc,
        E('td', 'py-cd', p.card ? (name[p.card] || p.card) : (p.how || '—')));
      if (anyRw) tr.append(p.reward_krw ? E('td', 'r py-rw', won(p.reward_krw)) : E('td', 'r py-rw dash', '—'));
      tb.append(tr);
    }
    rt.append(tb);
    const wrap = E('div', 'py-tbl-wrap'); wrap.append(rt);
    $('py-recent').innerHTML = ''; $('py-recent').append(d.recent.length ? wrap : E('div', 'empty', '아직 AI가 결제한 기록이 없어요. 결제하면 여기에 쌓여요.'));
  }

  async function load() {
    if (busy) return; busy = true;
    try {
      const r = await (window.barunFetch || fetch)('/api/pay');
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      render({ ...(await r.json()), extra: D && D.extra });
    } catch (e) {   // 토큰 창은 barunFetch가 띄움
      if (e.message !== '로그인 필요' && !D) {
        $('py-title').textContent = '결제 정보를 읽지 못했어요';
        $('py-lead').textContent = '1분 뒤에 다시 읽어요. 계속 안 되면 화면을 새로 고쳐 주세요.';
      }
    } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
