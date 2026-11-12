// 세금 환급 화면 — 독일·세율 19% 상품 인보이스를 모아 매월 1일 훗타운 세금 환급 신청(2026-10-27 사장님: "독일, 세율 19%인 상품의 인보이스를 모아놨다가 매월 1일에 훗타운에서 세금환급 신청").
// 순서 = 할 일 순: 이번 신청(D-day·ZIP·신청했어요) → 받아 올 인보이스 → 확인 필요(세율·금액·주문 고치기) → 신청 묶음 표 → 신청한 달(환급 받음) → 대상 아님.
// 읽기: GET /api/vat(ops/vat_refund.py) · PDF /api/vat/file?sha= · ZIP /api/vat/zip?w=batch|YYYY-MM|sha,… · 바꾸기: POST /api/action {action:'vat', op, …}.
// 자리: index.html에 미리 있는 화면(#p-vat)을 채운다(보임·숨김은 'barun:page' 이벤트).
// 2026-11-12 리뉴얼: 화면 글 해요체·AI 티 빼기, 공용 토큰·4px 격자, 휴대폰 단계 띠 가로로, 묶음 머리 '모두 고르기' 체크, 줄 버튼 'PDF 보기'·'빼기' 글자로.
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const ic = (name) => (window.ico ? window.ico(name) : '');
  const IE = (tag, cls, icon, txt) => { const e = E(tag, cls); e.innerHTML = ic(icon); if (txt) e.append(document.createTextNode(' ' + txt)); return e; };
  const eur = (x) => (x == null ? '—' : '€' + Number(x).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const won = (x, fx) => (x == null || !fx ? '' : `약 ${Math.round(x * fx).toLocaleString('ko-KR')}원`);
  const md = (iso) => (iso ? String(iso).slice(5, 10).replace('-', '/') : '');
  const mon = (ym) => `${+String(ym).slice(5, 7)}월`;
  // 시트 구매처 칸에 주소(https://www.….eu/)가 그대로 적힌 줄이 있어 화면에는 도메인만
  const dom = (s) => String(s || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/.*$/, '');
  let D = null, timer = 0, busy = false;
  const sel = new Set();          // 신청 묶음에서 고른 것(처음엔 전부)
  let selInit = '';               // 묶음이 바뀌면 다시 전부 고름

  function install() {
    const sec = $('p-vat'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      .vt-steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 4px 0 16px; counter-reset: st; }
      .vt-step { position: relative; padding: 12px 12px 12px 40px; border-radius: var(--r-sm); background: var(--fill2); box-shadow: inset 0 0 0 1px var(--line); font-size: 13px; color: var(--sub); min-width: 0; }
      .vt-step b { display: block; color: var(--ink); font-size: 13.5px; font-weight: 650; } .vt-step span { display: block; font-size: 12px; color: var(--muted); }
      .vt-step::before { counter-increment: st; content: counter(st); position: absolute; left: 12px; top: 12px; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center;
        background: var(--fill); color: var(--muted); font-size: 12px; font-weight: 700; }
      .vt-step.done::before { content: '✓'; background: var(--green-bg); color: var(--green-ink); }
      .vt-step.now { background: var(--blue-bg); box-shadow: inset 0 0 0 1.5px var(--blue); } .vt-step.now::before { background: var(--blue); color: #fff; }
      .vt-step-note { display: none; }
      .vt-acts { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 16px; }
      .vt-acts .grp { display: flex; gap: 8px; flex-wrap: wrap; } .vt-acts .grp + .grp.sub { margin-left: auto; }
      #p-vat .card { scroll-margin-top: calc(var(--bar-h) + 12px); }
      .vt-dday { display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: 999px; font-size: 13px; font-weight: 700; background: var(--blue-bg); color: var(--blue-ink); margin-left: 8px; vertical-align: 4px; }
      .vt-dday.today { background: var(--red); color: #fff; }
      #p-vat div.stat { cursor: default; }
      @media (hover: hover) { #p-vat div.stat:hover { transform: none; background-color: var(--fill2); box-shadow: inset 0 0 0 1px var(--line); } }
      @media (hover: hover) and (prefers-color-scheme: dark) { #p-vat div.stat:hover { box-shadow: none; } }
      .vt-head { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 12px; align-items: center; padding: 0 0 8px; border-bottom: 1px solid var(--line); font-size: 13px; color: var(--sub); }
      .vt-head label { display: contents; cursor: pointer; } .vt-head b { color: var(--ink); font-variant-numeric: tabular-nums; }
      .vt-row { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; gap: 12px; align-items: start; padding: 12px 0; border-top: 1px solid var(--line); }
      .vt-row.nochk { grid-template-columns: minmax(0, 1fr) auto; }
      .vt-row:first-child { border-top: 0; } .vt-row.off { opacity: .55; } .vt-row > div { min-width: 0; }
      .vt-row input[type=checkbox], .vt-head input[type=checkbox] { width: 18px; height: 18px; margin: 2px 0 0 2px; accent-color: var(--blue); cursor: pointer; }
      .vt-head input[type=checkbox] { margin-top: 0; }
      .vt-t { font-weight: 650; line-height: 1.4; display: flex; gap: 4px 8px; flex-wrap: wrap; align-items: center; min-width: 0; } .vt-t > span { min-width: 0; overflow-wrap: anywhere; }
      .vt-m { font-size: 13px; color: var(--sub); margin-top: 4px; overflow-wrap: anywhere; } .vt-m .ic { color: var(--muted); margin-right: 4px; }
      .vt-items { font-size: 13px; margin-top: 4px; color: var(--ink2); overflow-wrap: anywhere; }
      .vt-items .r7 { color: var(--muted); text-decoration: line-through; }
      .vt-side { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; text-align: right; }
      .vt-amt { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 15px; white-space: nowrap; } .vt-amt small { display: block; font-weight: 500; color: var(--green-ink); font-size: 12.5px; }
      .vt-amt.sm { font-size: 13px; font-weight: 600; color: var(--green-ink); }
      .vt-btns { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
      .vt-hint, .vt-warn { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; margin-top: 8px; padding: 8px 12px; border-radius: var(--r-sm); }
      .vt-hint { background: var(--fill2); color: var(--sub); } .vt-warn { background: var(--orange-bg); color: var(--orange-ink); }
      .vt-hint .ic, .vt-warn .ic { margin-top: 2px; }
      .vt-pos { color: var(--green-ink); }
      .vt-sum { display: flex; justify-content: space-between; gap: 8px 12px; flex-wrap: wrap; align-items: center; padding: 12px 16px; margin-top: 12px; border-radius: var(--r-sm); background: var(--fill2); font-size: 14px; }
      .vt-sum b { font-variant-numeric: tabular-nums; }
      .vt-fix { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
      .vt-fix select, .vt-fix input, .vt-dlg input, .vt-dlg select { font: inherit; font-size: 13.5px; min-height: 34px; padding: 0 12px; border-radius: var(--r-sm); border: 1px solid var(--line); background-color: var(--card); color: var(--ink); min-width: 0; }
      .vt-fix select:hover, .vt-fix input:hover, .vt-dlg input:hover, .vt-dlg select:hover { border-color: var(--axis); }
      .vt-fix input { flex: 1 1 112px; max-width: 160px; } .vt-fix input.wide { flex-basis: 152px; max-width: 200px; } .vt-fix select { flex: 0 1 auto; }
      .vt-dlg input, .vt-dlg select { min-height: 42px; font-size: 14.5px; }
      .vt-mon { border-top: 1px solid var(--line); } .vt-mon:first-child { border-top: 0; }
      #p-vat .vt-mon > summary { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; gap: 8px 12px; align-items: center; padding: 12px 8px; margin: 0 -8px;
        border-radius: var(--r-sm); color: var(--ink); font-size: 15px; }
      #p-vat .vt-mon > summary::before { justify-self: center; color: var(--muted); }
      #p-vat .vt-mon > summary:hover { background: var(--hover); }
      .vt-mon .bar { height: 6px; border-radius: 4px; background: var(--fill); overflow: hidden; margin-top: 8px; max-width: 260px; } .vt-mon .bar i { display: block; height: 100%; background: var(--green); }
      .vt-mon-tools { justify-content: flex-start; margin: 0 0 8px; }
      #p-vat .vt-oth-sum { display: flex; margin: 0; padding: 0; color: var(--ink); font-size: inherit; cursor: pointer; }
      #p-vat .vt-oth-sum::before { color: var(--muted); } #p-vat .vt-oth-sum:hover h2 { color: var(--blue-ink); }
      .vt-oth-list { margin-top: 12px; }
      dialog.vt-dlg { border: 0; padding: 0; border-radius: 20px; width: min(520px, calc(100vw - 24px)); background: var(--card); color: var(--ink); box-shadow: var(--pop); }
      dialog.vt-dlg::backdrop { background: rgba(0, 0, 0, .4); }
      .vt-dlg form { padding: 24px; display: grid; gap: 12px; } .vt-dlg h3 { margin: 0; font-size: 16.5px; font-weight: 700; letter-spacing: -.02em; }
      .vt-dlg p { margin: 0; color: var(--sub); font-size: 14px; } .vt-dlg p.who { color: var(--ink); font-weight: 600; }
      .vt-dlg label { display: grid; gap: 4px; font-size: 13px; font-weight: 600; color: var(--sub); }
      .vt-drop { box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 96px; padding: 24px 16px; border: 2px dashed var(--line);
        border-radius: var(--r-sm); background: transparent; color: var(--sub); font: inherit; font-size: 14px; text-align: center; cursor: pointer; overflow-wrap: anywhere; }
      .vt-drop:hover { background: var(--hover); }
      .vt-drop.on { border-color: var(--blue); background: var(--blue-bg); color: var(--blue-ink); }
      .vt-dlg-btns { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-top: 4px; }
      .vt-chips { display: flex; gap: 8px; flex-wrap: wrap; }
      @media (max-width: 760px) {
        .vt-steps { gap: 4px; margin-bottom: 8px; }
        .vt-step { padding: 32px 4px 8px; text-align: center; }
        .vt-step::before { left: 50%; top: 8px; transform: translateX(-50%); }
        .vt-step b { font-size: 12px; line-height: 1.3; } .vt-step span { display: none; }
        .vt-step-note { display: block; margin: 0 0 16px; font-size: 13px; color: var(--sub); }
      }
      @media (max-width: 640px) { .vt-row { grid-template-columns: 24px minmax(0, 1fr); } .vt-row.nochk { grid-template-columns: minmax(0, 1fr); }
        .vt-side { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; justify-content: flex-start; align-items: center; gap: 8px; text-align: left; }
        .vt-row:not(.nochk) .vt-side { grid-column: 2; }
        .vt-side .vt-btns { margin-left: auto; } .vt-side.wrapb .vt-btns { flex: 1 1 100%; margin-left: 0; justify-content: flex-start; }
        .vt-side .vt-amt small { display: inline; margin-left: 8px; } }
      @media (max-width: 560px) { .vt-acts .grp { flex: 1 1 100%; } .vt-acts .grp > .btn { flex: 1 1 0; } .vt-acts .grp + .grp.sub { margin-left: 0; }
        .vt-sum > .vt-btns { flex: 1 1 100%; } .vt-sum > .vt-btns > .btn { flex: 1 1 auto; } }
      @media (max-width: 600px) { .vt-fix input, .vt-fix select, .vt-dlg input, .vt-dlg select { font-size: 16px; } }`;
    document.head.append(css);
    sec.innerHTML = `
      <div class="card hero" id="vt-hero"><h2 id="vt-title">불러오는 중</h2><p class="lead" id="vt-lead"></p><div class="vt-steps" id="vt-steps"></div><p class="vt-step-note" id="vt-step-note"></p><div class="stats" id="vt-stats"></div><div class="vt-acts" id="vt-acts"></div></div>
      <div class="card" id="vt-miss-c" hidden><div class="card-h"><h2>받아 올 인보이스</h2><span class="desc">독일 19% 상품을 샀지만 인보이스 PDF가 아직 없는 주문이에요. 5일이 지나면 빨간색으로 보여요. shop-apotheke·parfum-zentrum은 매일 자동으로 받고, 다른 구매처는 PDF를 올리거나 #할-일 카드에 답글로 붙여 주세요.</span></div><div id="vt-miss"></div></div>
      <div class="card" id="vt-need-c" hidden><div class="card-h"><h2>확인 필요</h2><span class="desc">세율·금액·주문을 자동으로 읽지 못한 인보이스예요. 여기서 고친 값을 먼저 써요.</span></div><div id="vt-need"></div></div>
      <div class="card" id="vt-batch-c"><div class="card-h"><h2 id="vt-batch-h">신청 묶음</h2><span class="desc" id="vt-batch-d"></span></div><div id="vt-batch-head"></div><div id="vt-batch"></div><div id="vt-batch-sum"></div></div>
      <div class="card" id="vt-wait-c" hidden><div class="card-h"><h2>다음 달에 신청</h2><span class="desc">인보이스 날짜가 이번 기준일보다 늦어서 다음 달 1일에 같이 신청해요.</span></div><div id="vt-wait"></div></div>
      <div class="card"><div class="card-h"><h2>신청한 달</h2><span class="desc">훗타운 환급이 들어오면 [환급 받음]을 눌러 받은 금액을 적어 주세요.</span></div><div id="vt-months"></div></div>
      <div class="card"><details id="vt-oth-d"><summary class="card-h vt-oth-sum"><h2>환급 대상 아님</h2><span class="badge" id="vt-oth-n"></span><span class="desc">7% 상품(영양제·식품·동물 보조사료)만 있거나 독일 인보이스가 아닌 것이에요. 19% 상품이 있으면 [19%로]를 눌러 주세요.</span></summary><div id="vt-oth" class="vt-oth-list"></div></details></div>`;
    document.addEventListener('barun:page', (e) => { if (e.detail === 'vat') { load(); start(); } else stop(); });
    if (!sec.hidden) start();
    load();
    setInterval(() => { if (!document.hidden && $('p-vat').hidden) load(); }, 300000);
    return true;
  }
  // 2026-11-06: '확인 필요' 칸에 세율·금액을 적는 중에 60초 새로 읽기가 화면을 다시 그려 적던 값이 날아갔음 → 고치는 중이면 건너뜀
  const editing = () => !!document.querySelector('#p-vat .vt-fix [data-dirty]') || !!document.activeElement?.closest?.('#p-vat .vt-fix');
  const start = () => { stop(); timer = setInterval(() => { if (!document.hidden && !$('p-vat').hidden && !document.querySelector('dialog.vt-dlg[open]') && !editing()) load(); }, 60000); };
  const stop = () => { if (timer) clearInterval(timer); timer = 0; };
  const stat = (k, v, d, cls, go) => { const s = E(go ? 'button' : 'div', 'stat ' + (cls || '')); if (go) { s.type = 'button'; s.onclick = () => $(go).scrollIntoView({ behavior: 'smooth', block: 'start' }); } s.append(E('div', 'k', k)); const vv = E('div', 'v'); vv.innerHTML = v; s.append(vv, E('div', 'd', d || '')); return s; };
  const btn = (txt, cls, icon, fn, title) => { const b = icon ? IE('button', 'btn ' + cls, icon, txt) : E('button', 'btn ' + cls, txt); b.type = 'button'; if (title) b.title = title; b.onclick = (ev) => fn(b, ev); return b; };
  const say = (t) => { if (window.toast) window.toast(t); };

  async function act(body, b) {
    if (b) b.disabled = true;
    try {
      const r = await window.barunFetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'vat', ...body }) });
      const j = await r.json().catch(() => ({ ok: false, msg: '응답을 읽지 못했어요. 다시 누르기 전에 목록에 반영됐는지 확인해 주세요.' }));
      say(j.msg || (j.ok ? '처리했어요.' : '처리하지 못했어요. 다시 눌러 주세요.'));
      await load(true); return j;
    } catch (e) { say('보내지 못했어요. 연결을 확인하고 다시 눌러 주세요.'); return null; } finally { if (b) b.disabled = false; }
  }
  async function blob(path) { const r = await window.barunFetch(path); if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); }
  async function openPdf(sha, b) {
    const w = window.open('', '_blank');   // 팝업 막힘 피하려고 누른 순간 창부터
    try { if (b) b.disabled = true; const u = URL.createObjectURL(await blob('/api/vat/file?sha=' + sha)); if (w) w.location = u; else window.open(u, '_blank'); }
    catch (e) { if (w) w.close(); say('PDF를 열지 못했어요. [다시 읽기]를 누른 뒤 다시 열어 주세요.'); } finally { if (b) b.disabled = false; }
  }
  async function download(w, name, b) {
    try {
      if (b) b.disabled = true;
      const u = URL.createObjectURL(await blob('/api/vat/zip?w=' + encodeURIComponent(w)));
      const a = E('a'); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000);
      say(`${name} 파일을 받았어요.`);
    } catch (e) { say('ZIP 파일을 받지 못했어요. 잠시 뒤 다시 눌러 주세요.'); } finally { if (b) b.disabled = false; }
  }
  const pickedItems = () => (D ? D.batch.filter((i) => sel.has(i.sha)) : []);
  function tsv(items) {
    const head = ['훗타운 신청번호', '수령인', '판매처', '주문번호', '인보이스 번호', '날짜', '19% 대상(EUR)', '예상 환급(EUR)'];
    const lines = items.map((i) => [[...new Set(i.rows.map((x) => x.fwd).filter(Boolean))].join(' '), [...new Set(i.rows.map((x) => x.receiver).filter(Boolean))].join(' '),
      i.seller, i.order, i.inv_no, i.date, i.gross19 ?? '확인 필요', i.refund ?? ''].join('\t'));
    return [head.join('\t'), ...lines].join('\n');
  }
  async function copy(text) { try { await navigator.clipboard.writeText(text); say('복사했어요. 엑셀이나 메모에 붙여 넣으면 돼요.'); } catch (e) { say('복사하지 못했어요. 다시 눌러 주세요.'); } }

  // ── 창: 신청했어요 · PDF 올리기 · 빼기 · 환급 받음 ────────────────
  function dialog(build) {
    const d = E('dialog', 'vt-dlg'); const f = E('form'); f.method = 'dialog'; d.append(f); build(f, d);
    // 2026-11-06: 입력칸에서 Enter를 치면 첫 버튼인 [닫기]로 제출돼 창이 아무 말 없이 닫혔음(접수번호·금액이 저장된 줄 앎) → Enter는 주 버튼으로
    f.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing || e.target.tagName !== 'INPUT') return;
      e.preventDefault(); const main = f.querySelector('.btn.primary, .btn.danger'); if (main && !main.disabled) main.click();
    });
    d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal ? d.showModal() : d.setAttribute('open', ''); return d;
  }
  const closeBtn = () => { const b = E('button', 'btn ghost', '닫기'); b.value = 'no'; return b; };
  function applyDlg() {
    const items = pickedItems(); if (!items.length) { say('훗타운에 신청한 인보이스를 먼저 골라 주세요.'); return; }
    const g = items.reduce((a, i) => a + (i.gross19 || 0), 0), rf = items.reduce((a, i) => a + (i.refund || 0), 0);
    dialog((f, d) => {
      f.append(E('h3', null, `훗타운에 ${items.length}건 신청했나요?`),
        E('p', null, `19% 대상 ${eur(g)}, 예상 환급 ${eur(rf)}. 누르면 신청한 달로 옮기고 #할-일 신청 카드를 닫아요. 잘못 옮겼으면 신청한 달에서 되돌리면 돼요.`));
      const l1 = E('label', null, '어느 달 신청인가요'); const m = E('select'); for (const ym of monthsAround()) { const o = E('option', null, mon(ym) + ' 1일 신청'); o.value = ym; if (ym === D.apply_month) o.selected = true; m.append(o); } l1.append(m);
      const l2 = E('label', null, '훗타운 접수번호나 메모(선택)'); const ref = E('input'); ref.placeholder = '예: 환급 신청 접수 12345'; l2.append(ref);
      const row = E('div', 'vt-dlg-btns'); const no = closeBtn();
      const ok = E('button', 'btn primary', '신청한 달로 옮기기'); ok.type = 'button';
      ok.onclick = async () => { const j = await act({ op: 'apply', shas: items.map((i) => i.sha), month: m.value, ref: ref.value.trim() }, ok); if (j && j.ok) d.close(); };
      row.append(no, ok); f.append(l1, l2, row); setTimeout(() => ref.focus(), 30);
    });
  }
  function monthsAround() { const [y, m] = D.apply_month.split('-').map(Number); const out = []; for (let k = -2; k <= 1; k++) { const dt = new Date(y, m - 1 + k, 1); out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`); } return out; }
  function uploadDlg(order) {
    dialog((f, d) => {
      f.append(E('h3', null, '인보이스 PDF 올리기'), E('p', null, '구매처에서 받은 Rechnung(인보이스) PDF를 넣어 주세요. 세율을 읽어 그 주문에 붙이고, 원본 파일은 그대로 둬요.'));
      const inp = E('input'); inp.type = 'file'; inp.accept = 'application/pdf,.pdf'; inp.hidden = true;
      const drop = E('button', 'vt-drop'); drop.type = 'button'; const blank = () => { drop.innerHTML = ic('doc'); drop.append(document.createTextNode('PDF를 여기에 끌어다 놓거나 눌러서 고르세요')); }; blank();
      let file = null; const pick = (fl) => { if (!fl) return; file = fl; drop.textContent = `${fl.name} · ${Math.round(fl.size / 1024)}KB`; drop.classList.add('on'); };
      drop.onclick = () => inp.click(); inp.onchange = () => pick(inp.files[0]);
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('on'); }; drop.ondragleave = () => { if (!file) drop.classList.remove('on'); };
      drop.ondrop = (e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); };
      const l = E('label', null, '어느 주문의 인보이스인가요(공홈 주문번호)'); const o = E('input'); o.value = order || ''; o.setAttribute('list', 'vt-orders'); o.placeholder = '모르면 비워 두세요. PDF에서 찾아요';
      const dl = E('datalist'); dl.id = 'vt-orders'; for (const m of (D ? D.missing : [])) { const op = E('option'); op.value = m.order; op.label = `${dom(m.shop)} · ${m.rows.map((x) => x.receiver).join(' ')}`; dl.append(op); } l.append(o, dl);
      const row = E('div', 'vt-dlg-btns'); const no = closeBtn();
      const ok = E('button', 'btn primary', '올리기'); ok.type = 'button';
      ok.onclick = async () => {
        if (!file) { say('올릴 PDF를 먼저 골라 주세요.'); return; }
        if (file.size > 1400000) { say('1.4MB보다 큰 파일은 올릴 수 없어요.'); return; }
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(file); });
        const j = await act({ op: 'upload', filename: file.name, b64, order: o.value.trim() }, ok); if (j && j.ok) d.close();
      };
      row.append(no, ok); f.append(drop, inp, l, row);
    });
  }
  function excludeDlg(i) {
    dialog((f, d) => {
      f.append(E('h3', null, '환급 신청에서 뺄까요?'), E('p', 'who', `${i.seller || '판매처 모름'} · ${i.order ? '주문 ' + i.order : i.name}`),
        E('p', null, "'환급 대상 아님'으로 옮겨요. 나중에 거기서 [되돌리기]를 누르면 다시 들어가요."));
      const chips = E('div', 'vt-chips'); const l = E('label', null, '빼는 이유'); const r = E('input'); r.placeholder = '예: 반품됨';
      for (const t of ['반품·취소됨', '같은 인보이스 두 번', '환급 안 되는 판매처', '훗타운에서 거절']) { const c = E('button', 'chipbtn', t); c.type = 'button'; c.onclick = () => { r.value = t; }; chips.append(c); }
      l.append(r);
      const row = E('div', 'vt-dlg-btns'); const no = closeBtn(); const ok = E('button', 'btn danger', '빼기'); ok.type = 'button';
      ok.onclick = async () => { const j = await act({ op: 'exclude', sha: i.sha, note: r.value.trim() || '사람이 제외' }, ok); if (j && j.ok) d.close(); };
      row.append(no, ok); f.append(chips, l, row);
    });
  }
  function refundDlg(items) {
    const exp = items.reduce((a, i) => a + (i.refund || 0), 0);
    dialog((f, d) => {
      f.append(E('h3', null, `환급 ${items.length}건을 받았나요?`), E('p', null, `예상 금액은 ${eur(exp)}이에요. 실제로 들어온 금액을 적어 두면 신청한 달에 남아요. 모르면 비워 두세요.`));
      const l = E('label', null, '받은 금액 합계(EUR)'); const a = E('input'); a.type = 'number'; a.step = '0.01'; a.inputMode = 'decimal'; a.placeholder = exp.toFixed(2); l.append(a);
      const row = E('div', 'vt-dlg-btns'); const no = closeBtn(); const ok = E('button', 'btn primary', '받음으로 표시'); ok.type = 'button';
      let going = false;
      ok.onclick = async () => {   // 합계를 예상 비율대로 나눠 건마다 남김(한 건이면 그대로)
        if (going) return; going = true;   // 2026-11-06: 건마다 act가 버튼을 다시 켜서 여러 건 도는 사이 또 누르면 같은 건을 두 번 보냈음
        try {
          const tot = a.value === '' ? null : Number(a.value); let left = tot, j = null;
          for (const [n, i] of items.entries()) {
            const part = tot == null ? null : n === items.length - 1 ? Math.round(left * 100) / 100 : Math.round(tot * ((i.refund || 0) / (exp || 1)) * 100) / 100;
            if (part != null) left -= part;
            j = await act({ op: 'refunded', sha: i.sha, amount: part }, ok); if (!j || !j.ok) return;
          }
          d.close();
        } finally { going = false; }
      };
      row.append(no, ok); f.append(l, row); setTimeout(() => a.focus(), 30);
    });
  }

  // ── 줄 ─────────────────────────────────────────
  function invRow(i, opts = {}) {
    const d = E('div', 'vt-row' + (opts.check ? '' : ' nochk') + (opts.check && !sel.has(i.sha) ? ' off' : ''));
    if (opts.check) {
      const c = E('input'); c.type = 'checkbox'; c.checked = sel.has(i.sha); c.setAttribute('aria-label', `${i.seller} ${i.order} 신청에 넣기`);
      c.onchange = () => { if (c.checked) sel.add(i.sha); else sel.delete(i.sha); d.classList.toggle('off', !c.checked); renderHead(); renderSum(); }; d.append(c);
    }
    const body = E('div');
    const t = E('div', 'vt-t'); t.append(E('span', null, i.seller || '판매처 모름'), E('span', 'muted', i.order ? `주문 ${i.order}` : i.inv_no ? `인보이스 ${i.inv_no}` : i.name));
    if (i.kind === '혼합') t.append(E('span', 'badge warn', '19%+7% 섞임'));
    else if (i.kind === '19') t.append(E('span', 'badge run', '19%'));
    else if (i.kind === '7') t.append(E('span', 'badge', '7%'));
    if (i.override && (i.override.kind || i.override.gross19 != null)) t.append(E('span', 'badge', '고친 값'));
    if (i.status === '제외') t.append(E('span', 'badge bad', '제외됨'));
    body.append(t);
    const meta = [i.date ? `인보이스 ${md(i.date)}` : '날짜 모름', i.inv_no && i.order ? `번호 ${i.inv_no}` : '', `받은 날 ${md(i.got)}`].filter(Boolean).join(' · ');
    body.append(E('div', 'vt-m', meta));
    const who = i.rows.map((x) => `${x.receiver || '재고'}${x.fwd ? ' · ' + x.fwd : ''}`).filter((v, n, a) => a.indexOf(v) === n);
    if (who.length) { const m = E('div', 'vt-m'); m.innerHTML = ic('user'); m.append(document.createTextNode(who.join('  /  '))); m.title = i.rows.map((x) => `${x.tab} ${x.row}행 ${x.name} · ${x.progress}`).join('\n'); body.append(m); }
    if (i.items.length) {
      const it = E('div', 'vt-items');
      i.items.filter((x) => x.rate).forEach((x, n) => { if (n) it.append(document.createTextNode(' · ')); const s = E('span', x.rate === 19 ? '' : 'r7', `${x.desc} (${x.rate}%)`); if (x.rate !== 19) s.title = `${x.rate}% 상품이라 환급 대상이 아니에요`; it.append(s); });
      body.append(it);
    } else if (i.rows.length) body.append(E('div', 'vt-items', [...new Set(i.rows.map((x) => x.name))].join(' · ')));
    if (i.status === '제외' && i.note) body.append(E('div', 'vt-hint', '제외 이유: ' + i.note));
    for (const n of (opts.need ? i.need : [])) { const w = E('div', 'vt-warn'); w.innerHTML = ic('alert'); w.append(document.createTextNode(n)); body.append(w); }
    if (opts.fix) body.append(fixBar(i));
    d.append(body);
    const side = E('div', 'vt-side');
    const amt = E('div', 'vt-amt'); amt.textContent = i.gross19 == null ? '금액 모름' : eur(i.gross19);
    if (i.refund != null) { const s = E('small', null, `환급 ${eur(i.refund)}`); amt.append(s); }
    if (i.status === '환급됨' && i.refunded != null) { const s = E('small', null, `받음 ${eur(i.refunded)}`); amt.append(s); }
    amt.title = i.total != null ? `인보이스 합계 ${eur(i.total)}${i.vat['19'] ? ` · 19% 세액 ${eur(i.vat['19'])}` : ''}${i.vat['7'] ? ` · 7% 세액 ${eur(i.vat['7'])}` : ''}` : '';
    side.append(amt);
    const bt = E('div', 'vt-btns');
    bt.append(btn('PDF 보기', 'xs ghost', 'eye', (b) => openPdf(i.sha, b)));
    for (const x of (opts.extra || [])) bt.append(x);
    side.append(bt); d.append(side);
    return d;
  }
  function fixBar(i) {
    const f = E('div', 'vt-fix');
    const k = E('select'); k.setAttribute('aria-label', '세율'); for (const [v, l] of [['19', '19%만'], ['혼합', '19%+7%'], ['7', '7%만(대상 아님)']]) { const o = E('option', null, l); o.value = v; if (i.kind === v) o.selected = true; k.append(o); }
    if (!['19', '혼합', '7'].includes(i.kind)) { const o = E('option', null, '세율 고르기'); o.value = ''; o.selected = true; k.prepend(o); }
    const g = E('input'); g.type = 'number'; g.step = '0.01'; g.inputMode = 'decimal'; g.placeholder = '19% 금액 €'; g.setAttribute('aria-label', '19% 상품 금액(EUR)'); if (i.gross19 != null) g.value = i.gross19; g.title = '19% 상품 구매금(세금 포함). 7%만이면 비워 두세요';
    for (const x of [k, g]) x.addEventListener('input', () => { x.dataset.dirty = '1'; });
    const o = E('input', 'wide'); o.addEventListener('input', () => { o.dataset.dirty = '1'; }); o.placeholder = '공홈 주문번호'; o.setAttribute('aria-label', '공홈 주문번호'); o.value = (i.override || {}).order || (i.rows.length ? '' : i.order || ''); o.title = '시트 주문과 못 맞췄으면 공홈 주문번호를 적어 주세요';
    f.append(k, g, o, btn('저장', 'sm primary', 'check', (b) => act({ op: 'fix', sha: i.sha, kind: k.value, gross19: g.value, order: o.value.trim() }, b)),
      btn('빼기', 'sm ghost', '', () => excludeDlg(i), '환급 신청에서 빼기'));
    return f;
  }
  function missRow(m) {
    const d = E('div', 'vt-row nochk'); const body = E('div');
    const t = E('div', 'vt-t'); t.append(E('span', null, dom(m.shop)), E('span', 'muted', `주문 ${m.order}`)); body.append(t);
    body.append(E('div', 'vt-m', [m.ordered ? `주문일 ${md(m.ordered)}` : '', ...[...new Set(m.rows.map((x) => x.progress))]].filter(Boolean).join(' · ')));
    const who = E('div', 'vt-m'); who.innerHTML = ic('user'); who.append(document.createTextNode(m.rows.map((x) => `${x.receiver || '재고'} ${x.name.slice(0, 28)}${x.fwd ? ' · ' + x.fwd : ''}`).join('  /  '))); body.append(who);
    const h = E('div', 'vt-hint'); h.innerHTML = ic(m.pending ? 'clock' : m.auto ? 'zap' : 'info'); h.append(document.createTextNode('받는 곳: ' + m.how)); body.append(h);
    if (m.fetch_at) body.append(E('div', 'vt-m', `마지막 자동 받기 ${md(m.fetch_at)} ${String(m.fetch_at).slice(11, 16)} · ${m.fetch_msg}`));
    const side = E('div', 'vt-side wrapb');
    const age = E('span', 'badge ' + (m.pending ? '' : m.late ? 'bad' : m.age >= 3 ? 'warn' : ''), m.pending ? (m.age == null ? '발송 전' : `발송 전 · ${m.age}일`) : m.age == null ? '날짜 모름' : `${m.age}일째`);
    side.append(age);
    if (m.est_refund) side.append(E('div', 'vt-amt sm', `환급 약 ${eur(m.est_refund)}`));
    const bt = E('div', 'vt-btns');
    if (m.auto) bt.append(btn('자동으로 받기', 'xs primary', 'zap', (b) => fetchNow(m.order, b), '구매처 계정에서 지금 받아 와요(10~20초)'));
    bt.append(btn('PDF 올리기', 'xs weak', 'up', () => uploadDlg(m.order)), btn('번호 복사', 'xs ghost', 'copy', () => copy(m.order))); side.append(bt);
    d.append(body, side); return d;
  }
  async function fetchNow(order, b) {
    if (b) { b.disabled = true; b.dataset.h = b.innerHTML; b.textContent = '받는 중…'; }
    say('구매처 계정에서 인보이스를 받는 중이에요. 건당 10~20초 걸려요.');
    await act({ op: 'fetch', order: order || '' }, null);
    if (b) { b.disabled = false; b.innerHTML = b.dataset.h; }
  }
  const fill = (id, nodes, empty) => { const c = $(id); c.innerHTML = ''; if (!nodes.length && empty) c.append(E('div', 'empty', empty)); for (const n of nodes) c.append(n); };

  // 묶음 머리: 체크 칸 바로 위에 '모두 고르기'(2026-11-12 화면 점검: 오른쪽 끝 '모두·비우기'가 체크 칸과 멀었음)
  function renderHead() {
    const box = $('vt-batch-head'); box.innerHTML = '';
    if (!D || D.batch.length < 2) return;
    const n = D.batch.filter((i) => sel.has(i.sha)).length;
    const h = E('div', 'vt-head'); const l = E('label'); const c = E('input'); c.type = 'checkbox';
    c.checked = n === D.batch.length; c.indeterminate = n > 0 && n < D.batch.length;
    c.onchange = () => { if (c.checked) D.batch.forEach((i) => sel.add(i.sha)); else sel.clear(); render(D); };
    const s = E('span'); s.innerHTML = `모두 고르기 · <b>${D.batch.length}</b>건 중 <b>${n}</b>건 골랐어요`;
    l.append(c, s); h.append(l); box.append(h);
  }
  function renderSum() {
    const items = pickedItems(), box = $('vt-batch-sum'); box.innerHTML = '';
    if (!D || !D.batch.length) return;
    const g = items.reduce((a, i) => a + (i.gross19 || 0), 0), rf = items.reduce((a, i) => a + (i.refund || 0), 0);
    const s = E('div', 'vt-sum'); const l = E('div'); l.innerHTML = `고른 것 <b>${items.length}</b>/${D.batch.length}건 · 19% 대상 <b>${eur(g)}</b> · 예상 환급 <b class="vt-pos">${eur(rf)}</b> <span class="muted small">${won(rf, D.fx_eur)}</span>`;
    const r = E('div', 'vt-btns');
    r.append(btn('목록 복사', 'sm ghost', 'copy', () => copy(tsv(items)), '엑셀에 붙여 넣을 표로 복사해요'),
      btn(`ZIP 받기 (${items.length})`, 'sm weak', 'down', (b) => download(items.length === D.batch.length ? 'batch' : items.map((i) => i.sha).join(','), `세금환급_독일19_${D.apply_month}_${items.length}건.zip`, b)),
      btn('신청했어요', 'sm primary', 'check', applyDlg));
    s.append(l, r); box.append(s);
  }

  function render(d) {
    D = d;
    const c = d.counts, s = d.sums, fx = d.fx_eur;
    const ids = d.batch.map((i) => i.sha).join();
    if (ids !== selInit) { sel.clear(); for (const i of d.batch) if (!i.need.length || i.gross19 != null) sel.add(i.sha); selInit = ids; }   // 금액 모르는 것만 빼고 전부
    const badge = c.missing_late + c.need + (c.overdue || 0) + (d.days_left === 0 && c.batch ? 1 : 0);
    window.barunBadge && window.barunBadge('vat', badge);
    window.barunNew && window.barunNew('vat', d.last_new);
    const applyMon = +d.apply_day.slice(5, 7);
    const dd = d.days_left === 0 ? '<span class="vt-dday today">오늘 신청</span>' : `<span class="vt-dday">D-${d.days_left}</span>`;
    $('vt-title').innerHTML = `${applyMon}월 1일 세금 환급 신청 ${dd}`;
    $('vt-lead').title = '';
    // 금액 뒤 조사(€4.93를/을)가 읽는 법마다 갈려 금액 뒤에는 조사를 붙이지 않는다
    $('vt-lead').textContent = c.batch
      ? `독일 19% 인보이스 ${c.batch}건을 모았고, 예상 환급은 ${eur(s.batch_refund)}${fx ? `(${won(s.batch_refund, fx)})` : ''} 정도예요.` + (c.missing ? ` 인보이스가 없는 19% 주문 ${c.missing}건도 받아 오면 환급이 ${eur(s.missing_refund)} 늘어요.` : '')
      : c.missing ? `아직 모인 인보이스가 없어요. 인보이스가 없는 19% 주문 ${c.missing}건부터 받아 와 주세요.` : '이번 달에 신청할 독일 19% 인보이스가 아직 없어요. 메일로 오면 자동으로 모여요.';
    // 흐름 띠: 모으기 → 빠진 것 받기 → ZIP → 훗타운 신청 → 신청 완료 표시
    const steps = [['모으기', '메일 PDF 저장·세율 판정'], ['빠진 것 받기', c.missing ? `${c.missing}건 남음` : '빠진 것 없음'],
      ['ZIP 받기', `${applyMon}/1 신청일`], ['훗타운 신청', '세금 환급 메뉴에서'], ['신청 완료 표시', '[신청했어요] 누르기']];
    const now = d.days_left === 0 ? (c.missing_late ? 1 : 2) : c.missing ? 1 : 0;
    const st = $('vt-steps'); st.innerHTML = '';
    steps.forEach(([b, sp], n) => { const e = E('div', 'vt-step' + (n === now ? ' now' : n < now ? ' done' : '')); if (n === now) e.setAttribute('aria-current', 'step'); e.append(E('b', null, b), E('span', null, sp)); st.append(e); });
    $('vt-step-note').textContent = `지금 ${now + 1}단계 ${steps[now][0]} · ${steps[now][1]}`;
    const ss = $('vt-stats'); ss.innerHTML = '';
    // 점 색: 파랑 = 지금 할 것(이번 신청) · 초록 = 돈 · 주황·빨강 = 손볼 것 · 회색 = 기다림
    ss.append(stat('이번 신청', `${c.batch}<small>건</small>`, `대상 ${eur(s.batch_gross)}`, c.batch ? 'run' : '', 'vt-batch-c'),
      stat('예상 환급', eur(s.batch_refund), won(s.batch_refund, fx) || `구매금의 ${Math.round(d.rate * 100)}%`, c.batch ? 'ok' : ''),
      stat('인보이스 없음', `${c.missing}<small>건</small>`, c.missing ? `놓칠 수 있는 ${eur(s.missing_refund)}` : '빠진 것 없음', c.missing_late ? 'bad' : c.missing ? 'warn' : 'ok', c.missing ? 'vt-miss-c' : ''),
      stat('확인 필요', `${c.need}<small>건</small>`, c.need ? '세율·금액·주문' : '모두 판정함', c.need ? 'warn' : 'ok', c.need ? 'vt-need-c' : ''),
      stat('환급 대기', `${c.applied}<small>건</small>`, c.overdue ? `${c.overdue}건 60일 넘음` : c.applied ? `신청 ${eur(s.applied_refund)}` : '신청한 것 없음', c.overdue ? 'bad' : ''),
      stat('받은 환급', eur(s.refunded), `누적 ${c.done}건`, s.refunded ? 'ok' : ''));
    // 버튼: 주 행동(ZIP·신청했어요)과 보조(올리기·다시 읽기)를 두 묶음으로
    const acts = $('vt-acts'); acts.innerHTML = '';
    const main = E('div', 'grp'), sub = E('div', 'grp sub');
    if (c.batch) main.append(btn(`ZIP 받기 (${c.batch}건)`, 'primary', 'down', (b) => download('batch', `세금환급_독일19_${d.apply_month}_${c.batch}건.zip`, b), 'PDF와 목록.csv를 묶은 파일이에요. 훗타운에 올려요.'),
      btn('신청했어요', 'weak', 'check', applyDlg));
    if (c.auto) main.append(btn(`자동으로 받기 (${c.auto}건)`, c.batch ? '' : 'primary', 'zap', (b) => fetchNow('', b), '계정에서 인보이스를 받을 수 있는 구매처(shop-apotheke·parfum-zentrum) 주문을 지금 받아요'));
    sub.append(btn('PDF 올리기', 'ghost', 'up', () => uploadDlg('')), btn('다시 읽기', 'ghost', 'refresh', (b) => { b.disabled = true; load(true).finally(() => { b.disabled = false; }); }));
    if (main.children.length) acts.append(main);
    acts.append(sub);

    $('vt-miss-c').hidden = !d.missing.length; fill('vt-miss', d.missing.map(missRow), '');
    $('vt-need-c').hidden = !d.need.length; fill('vt-need', d.need.map((i) => invRow(i, { need: true, fix: true })), '');
    $('vt-batch-h').textContent = `${applyMon}월 1일 신청 묶음`;
    $('vt-batch-d').textContent = `인보이스 날짜가 ${md(d.cutoff)}까지인 독일 19% 인보이스예요. 금액을 모르는 것만 빼고 모두 골라 뒀어요.`;
    renderHead();
    fill('vt-batch', d.batch.map((i) => invRow(i, { check: true, extra: [btn('빼기', 'xs ghost', '', () => excludeDlg(i), '환급 신청에서 빼기')] })), '이번 신청에 넣을 인보이스가 없어요. 메일로 오면 자동으로 모여요.');
    renderSum();
    $('vt-wait-c').hidden = !d.waiting.length; fill('vt-wait', d.waiting.map((i) => invRow(i)), '');
    // 신청한 달
    const mb = $('vt-months'); mb.innerHTML = '';
    if (!d.months.length) mb.append(E('div', 'empty', '아직 신청한 달이 없어요. 훗타운에 신청하고 [신청했어요]를 누르면 여기에 쌓여요.'));
    for (const m of d.months) {
      const det = E('details', 'vt-mon'); const sm = E('summary');
      const l = E('div'); l.append(E('div', 'vt-t', `${mon(m.month)} 신청 · ${m.count}건`), E('div', 'vt-m', [m.applied_at ? `신청 ${md(m.applied_at)}` : '', m.by, m.ref].filter(Boolean).join(' · ')));
      const bar = E('div', 'bar'); const fillb = E('i'); fillb.style.width = `${m.count ? Math.round(m.done / m.count * 100) : 0}%`; bar.append(fillb); l.append(bar);
      const r = E('div', 'vt-amt', `${eur(m.refund)}`); r.append(E('small', null, m.done ? `받음 ${m.done}/${m.count} · ${eur(m.refunded)}` : '환급 대기'));
      sm.append(l, r); det.append(sm);
      const items = [...d.applied, ...d.done].filter((i) => i.batch === m.month);
      const tools = E('div', 'vt-btns vt-mon-tools');
      const open = items.filter((i) => i.status === '신청함');
      if (open.length) tools.append(btn(`환급 받음 (${open.length})`, 'xs primary', 'money', () => refundDlg(open)));
      tools.append(btn('ZIP 다시 받기', 'xs ghost', 'down', (b) => download(m.month, `세금환급_독일19_${m.month}_${m.count}건.zip`, b)), btn('목록 복사', 'xs ghost', 'copy', () => copy(tsv(items))));
      det.append(tools);
      for (const i of items) det.append(invRow(i, { extra: [i.status === '신청함' ? btn('받음', 'xs ghost', 'money', () => refundDlg([i])) : E('span', 'badge ok', '환급됨'),
        btn('되돌리기', 'xs ghost', 'back', (b) => act({ op: 'restore', sha: i.sha }, b), '신청 전으로 되돌려요')] }));
      mb.append(det);
    }
    // 대상 아님
    $('vt-oth-n').textContent = String(d.others.length);
    fill('vt-oth', d.others.map((i) => invRow(i, { extra: i.status === '제외' ? [btn('되돌리기', 'xs ghost', 'back', (b) => act({ op: 'restore', sha: i.sha }, b), '신청 묶음으로 되돌려요')]
      : i.country === 'DE' ? [btn('19%로', 'xs ghost', 'edit', (b) => act({ op: 'fix', sha: i.sha, kind: '19' }, b), '19% 상품이 있으면 눌러 주세요')] : [E('span', 'badge', i.country ? `${i.country} 인보이스` : '나라 모름')] })),
      '환급 대상이 아닌 인보이스가 없어요.');
  }

  async function load(force) {
    if (busy && !force) return; busy = true;
    // 2026-11-06: 503이면 '불러오는 중'에 멈춰 있던 것 → 실패를 보이고, 읽은 적 있으면 그 화면은 그대로
    try {
      const r = await (window.barunFetch || fetch)('/api/vat');
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      render(await r.json());
    } catch (e) {
      if (e.message === '로그인 필요') return;
      if (!D) {
        $('vt-title').textContent = '세금 환급 자료를 읽지 못했어요';
        const acts = $('vt-acts'); acts.innerHTML = '';
        acts.append(btn('다시 읽기', 'primary', 'refresh', (b) => { b.disabled = true; load(true).finally(() => { b.disabled = false; }); }));
      }
      const lead = $('vt-lead');
      lead.textContent = '1분 뒤에 다시 읽어요. 바로 보려면 [다시 읽기]를 눌러 주세요.' + (D ? ' 아래는 마지막으로 읽은 내용이에요.' : '');
      lead.title = e.message;
    } finally { busy = false; }
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
