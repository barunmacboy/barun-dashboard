// 결제 화면 — 카드 목록·적립 혜택·구매처별 카드·AI가 쓴 현황·추천 카드(2026-11-06 사장님: "현황판에 결제 섹션… 각 카드별 AI가 사용한 현황…
// 적립 혜택(얼마 이상 얼마까지 몇%)… 어떤 카드로 결제할지 선택… 구매처별로도 카드를 지정").
// 읽기: GET /api/pay(barun/payment_cards.snapshot) · 바꾸기: POST /api/action {action:'pay', op, …}. 카드번호는 받지 않는다 — 끝 4자리만.
// 자리: index.html에 미리 있는 화면(#p-pay)을 채운다(보임·숨김은 'barun:page' 이벤트).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const won = (x) => `${Math.round(Number(x) || 0).toLocaleString('ko-KR')}원`;
  const rng = (r) => `${r.basis === '월 사용액' ? '이번 달 사용액' : '한 번 결제'} ${won(r.min_krw)} 이상${r.max_krw ? ` ${won(r.max_krw)}까지` : ''}`;
  let D = null, timer = 0, busy = false;

  function install() {
    const sec = $('p-pay'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      #p-pay { display: grid; gap: 14px; }
      .py-card { padding: 14px 2px; border-top: 1px solid var(--line); } .py-card:first-child { border-top: 0; }
      .py-h { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; } .py-h b { font-size: 15px; }
      .py-m { font-size: 13px; color: var(--sub); margin-top: 4px; } .py-off { opacity: .55; }
      .py-rules { margin: 8px 0 0; padding: 0; list-style: none; font-size: 13px; }
      .py-rules li { display: flex; gap: 8px; align-items: center; justify-content: space-between; padding: 6px 10px; background: var(--fill2); border-radius: var(--r-sm); margin-top: 4px; }
      .py-form { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 8px; font-size: 13px; }
      .py-form input, .py-form select { font: inherit; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--card); color: var(--ink); min-width: 0; }
      .py-form input.n { width: 110px; } .py-form input.s { width: 64px; }
      .py-tbl { width: 100%; border-collapse: collapse; font-size: 13px; } .py-tbl td, .py-tbl th { padding: 7px 6px; border-top: 1px solid var(--line); text-align: left; }
      .py-tbl th { color: var(--muted); font-weight: 600; } .py-tbl td.r { text-align: right; font-variant-numeric: tabular-nums; }
      .py-pick { margin-top: 8px; font-size: 14px; }
      @media (max-width: 720px) { .py-form input.n { width: 92px; } }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero"><h2 id="py-title">불러오는 중</h2><p class="lead" id="py-lead">AI가 결제할 때 구매처 지정 카드, 없으면 적립이 가장 큰 카드를 골라요. 카드번호는 저장하지 않아요 — 끝 4자리만.</p><div class="stats" id="py-stats"></div></div>
      <div class="card"><div class="card-h"><h2>카드</h2><span class="desc">이번 달 AI 결제 · 적립 혜택(얼마 이상 얼마까지 몇%)</span></div><div id="py-cards"></div>
        <div class="py-form" id="py-add"><b>카드 추가</b><input id="py-name" placeholder="별칭(예: 신한 해외)" maxlength="40"><input id="py-issuer" placeholder="카드사" maxlength="30">
        <input id="py-last4" class="s" placeholder="끝 4자리" inputmode="numeric" maxlength="4" pattern="\\d{4}"><input id="py-fee" class="s" placeholder="해외수수료%" inputmode="decimal">
        <button class="btn sm" type="button" id="py-add-b">추가</button></div></div>
      <div class="card"><div class="card-h"><h2>구매처별 카드</h2><span class="desc">정하면 그 구매처는 늘 그 카드 · 비우면 적립이 가장 큰 카드</span></div><div id="py-shops"></div>
        <div class="py-form"><input id="py-shop-new" placeholder="구매처 도메인(예: prohealth.com)"><button class="btn sm ghost" type="button" id="py-shop-add">구매처 더하기</button></div></div>
      <div class="card"><div class="card-h"><h2>어떤 카드로 낼까</h2><span class="desc">구매처와 금액을 넣으면 AI가 고를 카드</span></div>
        <div class="py-form"><input id="py-q-shop" placeholder="구매처"><input id="py-q-krw" class="n" placeholder="금액(원)" inputmode="numeric"><button class="btn sm" type="button" id="py-q-b">고르기</button></div>
        <div class="py-pick" id="py-q-out"></div></div>
      <div class="card"><div class="card-h"><h2>최근 AI 결제</h2><span class="desc">결제 관문 기록 · 카드·예상 적립</span></div><div id="py-recent"></div></div>`;
    $('py-add-b').onclick = () => post({ op: 'card_save', name: $('py-name').value, issuer: $('py-issuer').value, last4: $('py-last4').value, fx_fee_pct: $('py-fee').value || 0 }, $('py-add-b'));
    $('py-shop-add').onclick = () => { const s = $('py-shop-new').value.trim(); if (s) { D.extra = [...(D.extra || []), s]; render(D); } };
    $('py-q-b').onclick = pickNow;
    document.addEventListener('barun:page', (e) => { if (e.detail === 'pay') { load(); start(); } else stop(); });
    if (!sec.hidden) start();
    return true;
  }

  const start = () => { stop(); load(); timer = setInterval(() => { if (!document.hidden && !$('p-pay').hidden) load(); }, 60000); };
  const stop = () => { if (timer) clearInterval(timer); timer = 0; };
  const stat = (k, v, d) => { const s = E('div', 'stat'); s.style.cursor = 'default'; s.append(E('div', 'k', k), E('div', 'v', v), E('div', 'd', d || '')); return s; };

  async function post(body, b) {
    if (b) b.disabled = true;
    try {
      const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pay', ...body }) });
      const j = await r.json(); if (window.toast) window.toast(j.msg); load(); return j;
    } catch (e) { return null; } finally { if (b) b.disabled = false; }
  }

  async function pickNow() {
    const out = $('py-q-out'); out.textContent = '고르는 중…';
    const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pay', op: 'pick', shop: $('py-q-shop').value, krw: Number(String($('py-q-krw').value).replace(/[^\d]/g, '')) || 0 }) });
    const j = await r.json();
    if (!j.ok) { out.textContent = j.msg; return; }
    let p; try { p = JSON.parse(j.msg); } catch (e) { out.textContent = j.msg; return; }
    out.innerHTML = '';
    out.append(E('div', '', `→ ${p.name}(끝 ${p.last4}) — ${p.why}`), E('div', 'py-m', `예상 적립 ${won(p.reward)} · 해외 수수료 ${won(p.fee)}`));
    for (const o of p.others || []) out.append(E('div', 'py-m', `${o.name}(끝 ${o.last4}): 적립 ${won(o.reward)} · 수수료 ${won(o.fee)}`));
  }

  function ruleForm(cd) {
    const f = E('div', 'py-form');
    const basis = E('select'); for (const b of D.basis) basis.append(new Option(b, b));
    const mn = E('input', 'n'); mn.placeholder = '이상(원)'; mn.inputMode = 'numeric';
    const mx = E('input', 'n'); mx.placeholder = '까지(원, 비우면 끝 없음)'; mx.inputMode = 'numeric';
    const pct = E('input', 's'); pct.placeholder = '%'; pct.inputMode = 'decimal';
    const cap = E('input', 'n'); cap.placeholder = '월 한도(원)'; cap.inputMode = 'numeric';
    const scope = E('select'); for (const s of ['전체', '해외', ...D.shops.map((x) => '구매처:' + x)]) scope.append(new Option(s, s));
    const b = E('button', 'btn sm ghost', '적립 혜택 더하기'); b.type = 'button';
    const num = (e) => Number(String(e.value).replace(/[^\d.]/g, '')) || 0;
    b.onclick = () => post({ op: 'reward_save', card: cd.id, basis: basis.value, min_krw: num(mn), max_krw: num(mx), pct: num(pct), cap_krw: num(cap), scope: scope.value }, b);
    f.append(basis, mn, mx, pct, cap, scope, b);
    return f;
  }

  function cardRow(cd) {
    const d = E('div', 'py-card' + (cd.active ? '' : ' py-off'));
    const h = E('div', 'py-h');
    h.append(E('b', '', cd.name), E('span', 'badge', `끝 ${cd.last4}`), E('span', 'muted small', [cd.issuer, cd.fx_fee_pct ? `해외 수수료 ${cd.fx_fee_pct}%` : ''].filter(Boolean).join(' · ')));
    const t = E('button', 'btn sm ghost', cd.active ? '끄기' : '켜기'); t.type = 'button';
    t.onclick = () => post({ op: cd.active ? 'card_off' : 'card_on', id: cd.id }, t);
    h.append(t);
    d.append(h, E('div', 'py-m', `이번 달 AI 결제 ${cd.month.n}건 · ${won(cd.month.krw)} · 예상 적립 ${won(cd.month.reward)}`));
    const ul = E('ul', 'py-rules');
    if (!cd.rewards.length) ul.append(E('li', 'muted', '적립 혜택 없음 — 아래에서 더하기'));
    for (const r of cd.rewards) {
      const li = E('li');
      li.append(E('span', '', `${rng(r)} → ${r.pct}%${r.cap_krw ? ` (월 ${won(r.cap_krw)}까지, 이번 달 ${won(r.used)})` : ''} · ${r.scope}`));
      const x = E('button', 'btn sm ghost', '지우기'); x.type = 'button'; x.onclick = () => post({ op: 'reward_del', id: r.id }, x);
      li.append(x); ul.append(li);
    }
    d.append(ul, ruleForm(cd));
    return d;
  }

  function shopRow(shop) {
    const tr = E('tr');
    const sel = E('select'); sel.append(new Option('적립 큰 카드 자동', ''));
    for (const cd of D.cards) if (cd.active) sel.append(new Option(`${cd.name}(끝 ${cd.last4})`, cd.id));
    sel.value = D.shop_cards[shop] || '';
    sel.onchange = () => post({ op: 'shop_set', shop, card: sel.value }, sel);
    const td = E('td'); td.append(sel);
    tr.append(E('td', '', shop), td);
    return tr;
  }

  function render(d) {
    D = d;
    const tot = d.cards.reduce((a, c) => ({ n: a.n + c.month.n, krw: a.krw + c.month.krw, rw: a.rw + c.month.reward }), { n: 0, krw: 0, rw: 0 });
    $('py-title').textContent = d.cards.length ? `${+d.month.slice(5)}월 AI 카드 결제 ${tot.n}건 · ${won(tot.krw)}` : '등록된 카드가 없어요 — 아래에서 카드를 추가해 주세요';
    const st = $('py-stats'); st.innerHTML = '';
    st.append(stat('쓰는 카드', String(d.cards.filter((c) => c.active).length), `전체 ${d.cards.length}`), stat('이번 달 결제', won(tot.krw), `${tot.n}건`),
      stat('예상 적립', won(tot.rw), '적립 혜택 기준'), stat('구매처 지정', String(Object.keys(d.shop_cards).length), '나머지는 자동'));
    const cs = $('py-cards'); cs.innerHTML = '';
    if (!d.cards.length) cs.append(E('div', 'muted small', '카드 없음'));
    for (const cd of d.cards) cs.append(cardRow(cd));
    const shops = [...new Set([...d.shops, ...(d.extra || [])])];
    const tb = E('table', 'py-tbl'); tb.innerHTML = '<tr><th>구매처</th><th>카드</th></tr>';
    for (const s of shops) tb.append(shopRow(s));
    $('py-shops').innerHTML = ''; $('py-shops').append(shops.length ? tb : E('div', 'muted small', '아직 결제한 구매처가 없어요 — 더하기로 넣을 수 있어요'));
    const name = Object.fromEntries(d.cards.map((c) => [c.id, `${c.name}(끝 ${c.last4})`]));
    const rt = E('table', 'py-tbl'); rt.innerHTML = '<tr><th>때</th><th>구매처</th><th>금액</th><th>상태</th><th>카드</th><th>예상 적립</th></tr>';
    for (const p of d.recent) {
      const tr = E('tr');
      tr.append(E('td', '', String(p.at || '').slice(5, 16).replace('T', ' ')), E('td', '', p.shop || ''), E('td', 'r', p.krw ? won(p.krw) : ''),
        E('td', '', p.status || ''), E('td', '', p.card ? (name[p.card] || p.card) : (p.how || '—')), E('td', 'r', p.reward_krw ? won(p.reward_krw) : ''));
      rt.append(tr);
    }
    $('py-recent').innerHTML = ''; $('py-recent').append(d.recent.length ? rt : E('div', 'muted small', '없음'));
  }

  async function load() {
    if (busy) return; busy = true;
    try { const r = await (window.barunFetch || fetch)('/api/pay'); if (r.ok) render({ ...(await r.json()), extra: D && D.extra }); }
    catch (e) { /* 토큰 창은 barunFetch가 띄움 */ } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
