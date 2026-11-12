// 보낸 문의 화면 — 배대지·구매처·쿠팡에 넣은 1:1 문의가 어디까지 왔나(2026-10-22 사장님: "여기저기 1:1 문의를 많이 넣는데 트래킹하는 화면").
// 순서 = 할 일 순: 답 옴(확인 필요) → 기다림(오래된 것 먼저, 2일 주황·4일 빨강) → 최근 끝. 읽기: GET /api/asks(ops/asks.py), 상태 바꾸기: POST /api/action {action:'ask'}.
// 자리: index.html에 미리 있는 화면(#p-…)을 채운다(보임·숨김은 'barun:page' 이벤트).
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const LVL = { new: 'run', bad: 'bad', warn: 'warn', wait: '', ok: 'ok' };   // 나이 꼬리표 색(2일 주황·4일 빨강)
  const noE = (t) => (window.noEmoji ? window.noEmoji(t) : String(t ?? ''));
  // 서버 글의 ' — '·' - ' 이음은 '·'로, 영어 상태 낱말은 우리말로(뜻은 그대로)
  const tidy = (t) => noE(t).replace(/\s+[—–-]\s+/g, ' · ').replace(/\bPending\b/g, '대기').trim();
  const ko = (t) => (window.koLabel ? window.koLabel(t) : t);
  const siteName = (s) => { const v = String(s || ''); const a = ko(v); if (a !== v) return a; const slug = v.split('.')[0]; const b = ko(slug); return b !== slug ? b : v; };
  const ic = (name) => { const e = E('span', 'ak-i'); e.innerHTML = window.ico ? window.ico(name) : ''; return e; };
  const LIMIT = 10;
  let timer = 0, busy = false, loaded = false, lastD = null, doneOpen = false;
  const more = {};
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');   // 2026-11-06: 글 주소는 http(s)만 — javascript: 링크 막기

  function install() {
    const sec = $('p-asks'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      #p-asks .stat { cursor: default; }
      @media (hover: hover) { #p-asks .stat:hover { transform: none; background: var(--fill2); box-shadow: inset 0 0 0 1px var(--line); } }
      @media (hover: hover) and (prefers-color-scheme: dark) { #p-asks .stat:hover { box-shadow: none; } }
      .ak-row { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 16px; padding: 16px 0; border-top: 1px solid var(--line); }
      .ak-row:first-child { border-top: 0; padding-top: 4px; }
      .ak-site { display: flex; align-items: flex-start; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--sub); padding-top: 2px; overflow-wrap: anywhere; min-width: 0; }
      .ak-body { display: grid; gap: 4px; min-width: 0; }
      .ak-top { display: flex; align-items: flex-start; gap: 12px; }
      .ak-t { flex: 1; min-width: 0; font-size: 15px; font-weight: 600; line-height: 1.45; color: var(--ink); overflow-wrap: anywhere; }
      .ak-top .badge { flex: none; margin-top: 1px; font-variant-numeric: tabular-nums; }
      .ak-m { font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
      .ak-memo { display: flex; gap: 4px; font-size: 13px; color: var(--sub); overflow-wrap: anywhere; }
      .ak-a { margin-top: 4px; padding: 8px 12px; background: var(--fill2); border-radius: var(--r-sm); font-size: 13.5px; color: var(--ink2); white-space: pre-wrap; overflow-wrap: anywhere; }
      .ak-a.clip { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
      .ak-a .ak-i { margin-right: 4px; vertical-align: -2px; }
      .ak-body > .more-link { justify-self: start; margin-left: 0; font-size: 13px; }
      .ak-btns { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
      .ak-btns .more-link { margin-left: auto; }
      .ak-i { display: inline-flex; color: var(--muted); }
      .ak-mob { display: none; }
      .ak-more { margin-top: 12px; }
      @media (max-width: 720px) { .ak-row { grid-template-columns: minmax(0, 1fr); gap: 4px; padding: 12px 0; } .ak-site { display: none; }
        .ak-mob { display: inline-flex; align-items: center; gap: 4px; margin-right: 4px; font-weight: 600; color: var(--ink2); } .ak-t { font-size: 14.5px; } }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero"><h2 id="ak-title">불러오는 중</h2><p class="lead" id="ak-lead"></p><div class="stats" id="ak-stats"></div></div>
      <div class="card"><div class="card-h"><h2>답이 온 문의</h2><span class="desc">답을 보고 조치까지 끝냈으면 [끝냈어요]를 눌러 주세요</span></div><div id="ak-new"></div></div>
      <div class="card"><div class="card-h"><h2>답을 기다리는 문의</h2><span class="desc">마지막으로 물은 때부터 센 시간이에요. 오래된 것부터, 2일 넘으면 주황·4일 넘으면 빨강</span></div><div id="ak-wait"></div></div>
      <div class="card"><div class="card-h"><h2>최근 끝난 문의</h2><span class="act"><button class="btn sm ghost" type="button" id="ak-done-t" aria-expanded="false" aria-controls="ak-done">보기</button></span><span class="desc">지난 14일</span></div><div id="ak-done" hidden></div></div>`;
    $('ak-done-t').onclick = () => { doneOpen = !doneOpen; if (lastD) render(lastD); };
    document.addEventListener('barun:page', (e) => { if (e.detail === 'asks') { load(); start(); } else stop(); });
    if (!sec.hidden) start();
    load();   // 탭 숫자(답 옴)는 처음부터
    setInterval(() => { if (!document.hidden && $('p-asks').hidden) load(); }, 120000);
    return true;
  }

  const start = () => { stop(); timer = setInterval(() => { if (!document.hidden && !$('p-asks').hidden) load(); }, 30000); };
  const stop = () => { if (timer) clearInterval(timer); timer = 0; };
  const stat = (k, v, d, cls) => { const s = E('div', 'stat ' + (cls || '')); s.append(E('div', 'k', k), E('div', 'v', v), E('div', 'd', d || '')); return s; };
  // 날짜뿐인 시각('YYYY-MM-DD'·옛 'T00:00:00')은 날짜만 — 시각을 지어내지 않음(ops/asks.py day_only와 같은 규칙)
  const dayOnly = (iso) => { const s = String(iso || ''); return s.length === 10 || s.slice(10, 19) === 'T00:00:00'; };
  const day = (iso) => !iso ? '' : dayOnly(iso) ? String(iso).slice(5, 10).replace('-', '/') : String(iso).slice(5, 16).replace('T', ' ').replace('-', '/');
  // 나이 = 기다림은 마지막으로 물은 때부터, 답 옴은 답 온 때부터(r.age_from). 날짜만 아는 것은 '3일 넘음'(적어도)
  const ageTxt = (r) => {
    const a = r.age || 0;
    if (r.age_exact === false) return a >= 1 ? `${Math.floor(a)}일 넘음` : '오늘·어제';
    const h = Math.round(a * 24);
    return h < 1 ? '방금' : h < 24 ? `${h}시간` : `${Math.floor(h / 24)}일 ${h % 24}시간`;
  };
  // 시트 줄 표시 '기타유럽:6'·'미국애견 54' → '기타유럽 6행'
  const refTxt = (ref) => { const m = String(ref || '').match(/^(.+?)\s*[: ]\s*(\d+)$/); return m ? `${m[1]} ${m[2]}행` : String(ref || ''); };
  // 기다리는 곳을 판매처·구매처·배대지로 묶어 센다(도메인 목록 대신)
  const FWD = /훗타운|포스트고|아이포터|몰테일|포스트몰|배대지/, MARKET = /쿠팡|네이버|셀러/;
  const bySite = (o) => {
    const g = { 판매처: 0, 구매처: 0, 배대지: 0 };
    for (const [k, v] of Object.entries(o || {})) { if (!v) continue; g[FWD.test(k) ? '배대지' : MARKET.test(k) ? '판매처' : '구매처'] += v; }
    return Object.entries(g).filter(([, v]) => v).map(([k, v]) => `${k}\u00a0${v}`).join(' · ');
  };

  // 2026-11-06: 실패해도 아무 말 없이 버튼만 다시 켜져 된 줄 알던 것 → 실패를 알리고, 응답을 못 읽으면 중복 누르기 전에 확인하라고
  async function setState(id, state, b) {
    b.disabled = true;
    try {
      const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ask', key: id, state }) });
      const j = await r.json().catch(() => ({ ok: false, msg: `응답을 읽지 못했어요(${r.status}). 목록에서 바뀌었는지 확인해 주세요.` }));
      if (window.toast) window.toast((j.ok ? '' : '실패: ') + (j.msg || (j.ok ? '바꿨어요' : '서버가 이유를 주지 않았어요')));
      if (!j.ok) b.disabled = false;
      load();
    } catch (e) { b.disabled = false; if (window.toast) window.toast('실패: ' + e.message); }
  }

  function row(r) {
    const d = E('div', 'ak-row');
    const site = E('div', 'ak-site', siteName(r.site)); if (!r.auto) { site.append(ic('hand')); site.title = '답을 직접 확인하는 곳'; }
    const body = E('div', 'ak-body');
    const top = E('div', 'ak-top'); top.append(E('div', 'ak-t', tidy(r.title) || `글 번호 ${r.no}`));
    // 꼬리표 하나: 끝난 것은 끝낸 날, 답 온 것은 답 온 지, 기다리는 것은 물은 지(색 = 2일 주황·4일 빨강)
    const done = r.state === '끝';
    const age = E('span', 'badge ' + (LVL[r.level] || ''), done ? `끝남 ${day(r.closed_at || r.answered_at || r.updated)}` : r.state === '답 옴' ? `답 옴 · ${ageTxt(r)}` : r.age_exact === false || ageTxt(r) === '방금' ? ageTxt(r) : `${ageTxt(r)}째`);
    age.title = done ? '끝낸 때' : r.state === '답 옴' ? '답 온 지' : '마지막으로 물은 지';
    top.append(age); body.append(top);
    const asked = r.state === '기다림' && r.age_from && r.age_from !== r.sent_at ? `${day(r.age_from)} 다시 물음` : '';
    const got = r.state === '답 옴' && r.answered_at ? `${day(r.answered_at)} 답 옴` : '';
    const prev = (r.replaces || []).length ? `이전 글 ${r.replaces.map((x) => x.no).join('·')}` : '';
    const meta = [`글 번호 ${r.no}`, refTxt(r.ref), r.sent_at ? `${day(r.sent_at)} 보냄` : '', asked, got, prev, r.by].filter(Boolean).join(' · ');
    const mm = E('div', 'ak-m');
    const mob = E('span', 'ak-mob', siteName(r.site)); if (!r.auto) mob.append(ic('hand')); mob.append(document.createTextNode('·'));   // 좁은 화면에서만 보이는 출처
    mm.append(mob, document.createTextNode(meta)); body.append(mm);
    if (r.memo) { const m = E('div', 'ak-memo'); m.append(ic('edit'), document.createTextNode(tidy(r.memo))); body.append(m); }
    if (r.answer) {
      const text = noE(r.answer);
      const a = E('div', 'ak-a'); if (r.state !== '기다림') a.append(ic('chat')); a.append(document.createTextNode(text)); body.append(a);
      // 긴 답은 4줄까지만 — 펼치기
      if (text.length > 180 || text.split('\n').length > 4) {
        a.classList.add('clip');
        const t = E('button', 'more-link', '펼치기'); t.type = 'button'; t.setAttribute('aria-expanded', 'false');
        t.onclick = () => { const open = a.classList.toggle('clip'); t.textContent = open ? '펼치기' : '접기'; t.setAttribute('aria-expanded', String(!open)); };
        body.append(t);
      }
    }
    const bt = E('div', 'ak-btns');
    if (!done) { const b = E('button', 'btn sm ' + (r.state === '답 옴' ? 'primary' : 'weak'), '끝냈어요'); b.type = 'button'; b.title = '조치까지 끝났으면 눌러 주세요'; b.onclick = () => setState(r.id, '끝', b); bt.append(b); }
    if (r.state === '답 옴') { const b = E('button', 'btn sm ghost', '다시 물었어요'); b.type = 'button'; b.onclick = () => setState(r.id, '기다림', b); bt.append(b); }
    if (safeUrl(r.url)) { const a = E('a', 'more-link', '글 열기 ›'); a.href = safeUrl(r.url); a.target = '_blank'; a.rel = 'noopener'; bt.append(a); }
    if (bt.children.length) body.append(bt);
    d.append(site, body);
    return d;
  }
  // 목록은 10건까지 먼저, 나머지는 '더 보기'
  const fill = (id, list, emptyText) => {
    const c = $(id); c.innerHTML = '';
    if (!list.length) { c.append(E('p', 'muted small', emptyText)); return; }
    for (const r of (more[id] ? list : list.slice(0, LIMIT))) c.append(row(r));
    if (list.length > LIMIT) {
      const b = E('button', 'btn sm ghost ak-more', more[id] ? '접기' : `나머지 ${list.length - LIMIT}건 더 보기`); b.type = 'button';
      b.onclick = () => { more[id] = !more[id]; if (lastD) render(lastD); };
      c.append(b);
    }
  };

  function render(d) {
    lastD = d;
    const nNew = d.answered.length, nWait = d.waiting.length, nOver = d.overdue.length;
    if (window.barunBadge) window.barunBadge('asks', nNew);   // 메뉴 숫자(답 옴)
    $('ak-title').textContent = nNew ? `답이 온 문의 ${nNew}건을 확인해 주세요` : nOver ? `2일 넘게 답이 없는 문의가 ${nOver}건 있어요` : nWait ? `답을 기다리는 문의 ${nWait}건` : '열린 문의가 없어요';
    $('ak-lead').textContent = d.auto_pct == null ? '손 모양이 붙은 곳은 답이 왔는지 직접 봐 주세요.' : `열린 문의의 ${d.auto_pct}%는 답이 왔는지 자동으로 확인해요. 손 모양이 붙은 곳은 직접 봐 주세요.`;
    const st = $('ak-stats'); st.innerHTML = '';
    st.append(stat('답 옴', String(nNew), '확인할 문의', nNew ? 'run' : ''), stat('답 기다림', String(nWait), bySite(d.by_site)),
      stat('2일 넘음', String(nOver), '다시 물어볼지 보기', nOver ? 'warn' : ''), stat('최근 끝남', String(d.done.length), '지난 14일', ''));
    fill('ak-new', d.answered, '새로 답이 온 문의가 없어요. 답이 오면 여기에 먼저 보여요.');
    fill('ak-wait', [...d.waiting].sort((a, b) => b.age - a.age), '답을 기다리는 문의가 없어요.');
    const dt = $('ak-done-t'), dl = $('ak-done');
    dt.textContent = doneOpen ? '접기' : d.done.length ? `${d.done.length}건 보기` : '보기'; dt.setAttribute('aria-expanded', String(doneOpen)); dt.hidden = !d.done.length;
    dl.hidden = !doneOpen && !!d.done.length;
    fill('ak-done', d.done, '지난 14일 동안 끝낸 문의가 없어요.');
  }

  async function load() {
    if (busy) return; busy = true;
    // 2026-11-06: 서버가 503이면 제목이 '불러오는 중'에 영영 멈춰 있던 것 → 실패를 보이고, 전에 읽은 목록은 그대로 둠
    try {
      const r = await (window.barunFetch || fetch)('/api/asks');
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      render(await r.json()); loaded = true;
    } catch (e) {
      if (e.message === '로그인 필요') return;
      $('ak-lead').textContent = `보낸 문의를 읽지 못했어요(${e.message}). 잠시 뒤 다시 읽어요.` + (loaded ? ' 아래는 마지막으로 읽은 목록이에요.' : '');
      if (!loaded) $('ak-title').textContent = '문의 목록을 읽지 못했어요';
    } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
