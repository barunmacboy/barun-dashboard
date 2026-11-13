/* 운영 건강 화면: 장애, 복구 검증, 자료 신선도와 확인 범위를 한곳에 보여 준다. */
(() => {
  const $ = id => document.getElementById(id);
  const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const go = (text, page) => { const b = node('button', 'btn sm', text); b.type = 'button'; b.onclick = () => window.showTab(page); return b; };
  const names = { jobs: '자동 작업', heartbeats: '진행 신호', hub: '감시 허브', worklog: '작업 일지', events: '알림', git: '변경 기록', backup: '백업', tasks: '맡긴 일', improve: '개선 기록', issues: '할 일', board: '일 보드', barund: '실행 대기열', usage: '사용량', savings: '절감 효과', operations: '운영 건강', status_md: '운영 메모', invoices: '인보이스', team: '담당자', approvals: '승인 대기' };
  // 2026-11-12 리뉴얼: 이 화면 전용 모양 — 공용 토큰만. 정상 줄은 접어 한 줄로, 문제 있는 줄만 펼쳐 보인다.
  (() => {
    const st = document.createElement('style');
    st.textContent = `
      #p-health .stat { cursor: default; }
      @media (hover: hover) { #p-health .stat:hover { transform: none; background: var(--fill2); box-shadow: inset 0 0 0 1px var(--line); } }
      @media (hover: hover) and (prefers-color-scheme: dark) { #p-health .stat:hover { box-shadow: none; } }
      .hl-allok { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin: 0; padding: 12px 16px; border-radius: var(--r-sm);
        background: var(--green-bg); color: var(--green-ink); font-size: 14px; font-weight: 600; }
      .hl-allok .dot { background: currentColor; }
      .hl-allok span:last-child { font-weight: 500; }
      .hl-row { display: grid; gap: 4px; padding: 12px 0; border-top: 1px solid var(--line); min-width: 0; }
      .hl-row:first-of-type { border-top: 0; padding-top: 0; }
      .hl-t { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0; font-size: 15px; font-weight: 600; line-height: 1.45; color: var(--ink); min-width: 0; }
      .hl-m { margin: 0; font-size: 13.5px; color: var(--sub); overflow-wrap: anywhere; }
      .hl-row details { margin-top: 4px; }
      .hl-none { margin: 0; font-size: 14px; color: var(--muted); }
      .hl-note { margin: 8px 0 0; font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
      .hl-err { margin: 8px 0 0; font-size: 13px; font-weight: 600; color: var(--orange-ink); }
      .hl-warn { color: var(--orange-ink) !important; font-weight: 600; }
      #p-health .card > .btn { margin-top: 12px; }
      #p-health .sys li > :nth-child(2) { min-width: 0; overflow-wrap: anywhere; color: var(--ink2); font-size: 14px; }
      #p-health .sys li > :last-child { white-space: nowrap; }
      .hl-group > summary { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 10px 0; font-size: 14px; color: var(--ink2); }
      .hl-group > summary::before { order: 3; margin-left: 4px; }
      .hl-group > summary b { font-weight: 600; }
      .hl-group > summary .muted { margin-left: auto; font-size: 13px; }
      .hl-group > summary:hover { color: var(--ink); }
      .hl-group[open] > summary { border-bottom: 1px solid var(--line); }
      .hl-group .sys { margin: 0 !important; }
      .hl-steps { list-style: none; margin: 0; padding: 0; }
      .hl-steps li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; align-items: baseline; padding: 10px 0; border-top: 1px solid var(--line); font-size: 14px; }
      .hl-steps li:first-child { border-top: 0; padding-top: 0; }
      .hl-steps b { font-weight: 600; color: var(--ink2); }
      .hl-steps .muted { font-size: 13px; font-variant-numeric: tabular-nums; text-align: right; }
      @media (max-width: 560px) { .hl-steps li { grid-template-columns: minmax(0, 1fr); } .hl-steps .muted { text-align: left; } }
      #health-preview .hp-lead { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--ink2); }
      #health-preview .hp-lead.ok { color: var(--green-ink); }
      #health-preview .hp-sub { margin: 4px 0 0; font-size: 13px; color: var(--muted); }`;
    document.head.append(st);
  })();
  // 걸린 시간: 1분 넘으면 분으로(358초 → 6분)
  const dur = secs => { const s = Math.round(secs || 0); return s < 60 ? `${s}초` : s < 3600 ? `${Math.round(s / 60)}분` : `${Math.floor(s / 3600)}시간 ${Math.round(s % 3600 / 60)}분`; };
  const when = iso => String(iso || '').slice(5, 16).replace('T', ' ').replace('-', '/');
  let current;
  function draw(s) {
    current = s;
    const p = $('p-health'); if (!p) return;
    const h = s.operations || {}, incidents = h.incidents || [];
    const today = String(s.now || '').slice(0, 10);
    const at = iso => !iso ? '' : String(iso).slice(0, 10) === today ? String(iso).slice(11, 16) : when(iso);   // 오늘이면 시각만
    const failed = Object.entries(s.sections || {}).filter(([, v]) => v.state !== 'ok');
    const notice = $('connection-notice');
    if (notice) { notice.hidden = !failed.length; notice.textContent = failed.length ? `${failed.map(([k]) => names[k] || k).join(', ')} 자료를 다시 읽는 중이에요. 그동안은 마지막으로 읽은 값을 보여 드려요.` : ''; }
    if (failed.length) { const hp = $('health'); hp.className = 'health warn'; hp.querySelector('.htxt').textContent = '자료 확인 중'; }
    const nOpen = incidents.filter(x => ['open', 'held'].includes(x.state)).length;
    const nVerify = incidents.filter(x => x.state === 'verifying').length;
    const nStuck = incidents.filter(x => x.state === 'stuck').length;
    const unread = s.sections?.operations?.state !== 'ok' || !!h.errors?.incidents;
    const sources = Object.values(h.hub?.sources || {});
    const live = sources.filter(v => !v.paused), liveOk = live.filter(v => v.ok).length;
    const checked = h.hub?.at || h.at || s.now;
    // 한눈에(홈) 요약 카드
    const brief = $('health-preview');
    if (brief) {
      const head = node('div', 'card-h');
      head.append(node('h2', '', '운영 건강'));
      if (incidents.length) head.append(node('span', 'badge ' + (nStuck ? 'bad' : 'warn'), `열린 문제 ${incidents.length}`));
      const more = node('button', 'more-link', '자세히 ›'); more.type = 'button'; more.dataset.goto = 'health'; head.append(more);
      const lead = incidents.length
        ? [nStuck && `판단이 필요한 문제 ${nStuck}건`, nOpen && `원인 찾는 중 ${nOpen}건`, nVerify && `복구 확인 중 ${nVerify}건`].filter(Boolean).join(' · ')
        : unread ? '복구 상태를 아직 읽지 못했어요' : '이상 없어요';
      brief.replaceChildren(head, node('p', 'hp-lead' + (!incidents.length && !unread ? ' ok' : ''), lead));
      if (live.length) brief.append(node('p', 'hp-sub', (liveOk === live.length ? `감시 ${live.length}곳 모두 정상` : `감시 ${live.length}곳 중 ${live.length - liveOk}곳 확인 필요`) + (checked ? ` · ${at(checked)} 확인` : '')));
    }
    // 펼치기·키보드 초점은 같은 DOM 노드를 재사용해 자동 갱신 중에도 유지한다.
    const kept = new Map([...p.querySelectorAll('details[data-incident]')].map(x => [x.dataset.incident, x]));
    const keptActions = new Map([...p.querySelectorAll('button[data-health-action]')].map(x => [x.dataset.healthAction, x]));
    const focused = p.contains(document.activeElement) ? document.activeElement : null;
    const action = (text, page, id) => { const b = keptActions.get(id) || go(text, page); b.textContent = text; b.dataset.healthAction = id; return b; };
    const fragment = document.createDocumentFragment();
    const detailNode = (id, cls) => {
      const d = kept.get(id) || node('details', cls || ''); d.dataset.incident = id;
      if (!d.querySelector('summary')) d.append(node('summary'));
      for (const child of [...d.children]) if (child.tagName !== 'SUMMARY') child.remove();
      return d;
    };
    const sysRow = r => { const li = node('li'); const v = node('span', 'muted small' + (r.warn ? ' hl-warn' : ''), r.value); li.append(node('span', 'dot ' + r.dot), node('span', '', r.label), v); return li; };
    // 문제 있는 줄은 그대로, 정상 줄은 '정상 n곳'으로 접어 둔다
    const statusList = (box, id, rows, unit, lastAt) => {
      const bad = rows.filter(r => !r.ok), good = rows.filter(r => r.ok);
      if (bad.length) { const ul = node('ul', 'sys'); bad.forEach(r => ul.append(sysRow(r))); box.append(ul); }
      if (!good.length) return;
      const d = detailNode(id, 'hl-group'), sm = d.querySelector('summary'); sm.textContent = '';
      sm.append(node('span', 'dot ok'), node('b', '', `정상 ${good.length}${unit}`), node('span', 'muted', lastAt ? `${at(lastAt)} 확인` : ''));
      const ul = node('ul', 'sys'); good.forEach(r => ul.append(sysRow(r))); d.append(ul); box.append(d);
    };
    // 첫 카드: 결론 한 줄 + 숫자(다 괜찮으면 초록 한 줄)
    const intro = node('section', 'card hero');
    const title = nStuck ? `판단이 필요한 문제가 ${nStuck}건 있어요` : (nOpen + nVerify) ? `복구 중인 문제가 ${nOpen + nVerify}건 있어요` : unread ? '복구 상태를 읽는 중이에요' : '열린 문제가 없어요';
    intro.append(node('h2', '', title), node('p', 'lead', '문제가 생기면 먼저 자동으로 고치고, 실제로 정상으로 도는지 확인한 뒤 닫아요. 같은 문제가 되풀이되거나 확인이 안 되면 원인을 따로 찾아요.'));
    if (incidents.length) {
      const counts = node('div', 'stats');
      for (const [label, val, desc, cls] of [['원인 찾는 중', nOpen, '에이전트가 원인을 보는 중', nOpen ? 'warn' : ''], ['복구 확인 중', nVerify, '고친 뒤 정상인지 보는 중', nVerify ? 'run' : ''], ['판단 필요', nStuck, '할 일 카드에서 정해 주세요', nStuck ? 'bad' : '']]) {
        const n = node('div', 'stat ' + cls); n.append(node('div', 'k', label), node('div', 'v', val), node('div', 'd', desc)); counts.append(n);
      }
      intro.append(counts);
    } else if (!unread) {
      const ok = node('p', 'hl-allok'); ok.append(node('span', 'dot'), node('span', '', '이상 없음'), node('span', '', [live.length && `감시 ${liveOk}/${live.length}곳 정상`, checked && `${at(checked)} 확인`].filter(Boolean).join(' · ')));
      intro.append(ok);
    }
    fragment.append(intro);
    const section = (title, desc) => { const c = node('section', 'card'), hh = node('div', 'card-h'); hh.append(node('h2', '', title)); if (desc) hh.append(node('span', 'desc', desc)); c.append(hh); fragment.append(c); return c; };
    const row = (badge, badgeCls, title, text) => {
      const r = node('article', 'hl-row'), t = node('h3', 'hl-t');
      if (badge) t.append(node('span', 'badge ' + (badgeCls || ''), badge));
      t.append(document.createTextNode(title || ''));
      r.append(t); if (text) r.append(node('p', 'hl-m', text));
      return r;
    };
    const issues = section('열린 문제', '지금 상태와 다음에 할 일');
    if (!incidents.length) issues.append(node('p', 'hl-none', unread ? '복구 상태를 읽지 못했어요. 잠시 뒤 다시 읽어요.' : '열린 문제가 없어요. 새로 생기면 여기에 바로 보여요.'));
    for (const i of incidents) {
      const item = row(i.label, i.state === 'stuck' ? 'bad' : i.state === 'verifying' ? 'run' : 'warn', i.title, i.next);
      const detail = detailNode(i.id); detail.querySelector('summary').textContent = `근거와 기록 · ${i.recur}번 되풀이 · 에이전트에게 ${i.tries}번 맡김`;
      const pre = node('pre'); pre.textContent = i.detail || ''; detail.append(pre);
      item.append(detail); issues.append(item);
    }
    if (nStuck) issues.append(action('할 일 카드 보기', 'todo', 'decisions'));
    const ex = h.execution || {}, active = ex.active || [], queued = ex.queue || [];
    const progress = section('지금 도는 작업', '단계와 기다리는 이유');
    if (!active.length && !queued.length) progress.append(node('p', 'hl-none', h.execution ? '지금 돌거나 차례를 기다리는 자동 작업이 없어요.' : '실행 상태를 읽는 중이에요.'));
    for (const r of active) {
      const [lab, cls] = ({ running: ['진행 중', 'run'], slow: ['응답 늦음', 'warn'], interrupted: ['끝났는지 확인 필요', 'bad'] })[r.status] || ['확인 중', ''];
      const item = row(lab, cls, r.title, `${r.phase} · 이 단계 ${dur(r.phase_secs)} · 모두 ${dur(r.secs)}`);
      if (r.status === 'slow') item.append(node('p', 'hl-note', '응답이 늦어요. 끝나면 실제로 처리됐는지 다시 확인해요.'));
      progress.append(item);
    }
    for (const r of queued) {
      const item = row(r.state === 'running' ? '에이전트 작업 중' : '차례 대기', r.state === 'running' ? 'run' : '', r.title, `${r.reason} · 들어온 지 ${dur(r.age_secs)}`);
      if (r.kind === 'browser' && String(r.reason || '').includes('작업판')) item.append(action('앞선 일 보기', 'tasks', r.id));
      progress.append(item);
    }
    if (ex.slowest?.length) {
      const slow = section('오래 걸린 단계', `최근 24시간 동안 끝난 회차 ${ex.sample_runs}회 기준이에요. 단계끼리 시간이 겹칠 수 있어 더하지 않았어요.`);
      const list = node('ul', 'hl-steps');
      for (const r of ex.slowest) {
        const li = node('li'), t = node('span'); t.append(node('b', '', r.title), document.createTextNode(` · ${r.phase}`));
        li.append(t, node('span', 'muted', `${r.count}회 · 평균 ${dur(r.avg_secs)} · 가장 길게 ${dur(r.max_secs)}${r.fails ? ` · 실패 ${r.fails}회` : ''}`));
        list.append(li);
      }
      slow.append(list);
    }
    const service = section('감시 상태', '새 주문·메일·문의를 몇 분마다 확인해요. 업무별 결과는 실행 내역에 있어요.');
    const srcRows = sources.map(v => ({ dot: v.paused ? 'idle' : v.ok ? 'ok' : 'warn', label: v.label, ok: v.paused || v.ok,
      value: v.paused ? '운영 시간 밖' : v.running ? `확인 중${v.secs >= 60 ? ` · ${dur(v.secs)}째` : ''}` : v.ok ? `정상${v.last_ok ? ' · ' + at(v.last_ok) : ''}` : v.fails ? `연속 실패 ${v.fails}회` : '확인 늦음' }));
    // 2026-11-06: q.at은 시간대 없는 한국 시각 — 기기 시계(Date.now)와 비교하면 해외·시계 어긋난 기기에서 늘 '확인 필요'였음 → 서버 now와 비교
    const q = h.queue || {}; const qBase = Date.parse(s.now || '') || Date.now(); const qa = q.at && qBase - Date.parse(q.at) < 120000;
    srcRows.push({ dot: qa ? 'ok' : 'warn', label: '실행 대기열', ok: !!qa, value: qa ? `정상 · ${at(q.at)}` : '2분 넘게 신호 없음' });
    statusList(service, 'sources-ok', srcRows, '곳', checked);
    service.append(action('실행 내역 보기', 'work', 'runs'));
    const cv = h.monitor?.coverage || {}, coverage = section('감시가 확인한 범위', '근거가 부족한 건은 정상으로 치지 않아요');
    const cl = node('ul', 'sys');
    for (const [kind, unit] of [['운임', '개'], ['손익', '건']]) {
      const lack = cv[kind + '근거부족'], cmp = cv[kind + '비교'];
      const total = (+cmp || 0) + (+lack || 0);
      cl.append(sysRow({ dot: lack ? 'warn' : lack === 0 ? 'ok' : 'idle', label: `${kind} 비교 ${cmp ?? '—'}${unit}${kind === '손익' && cv['손익예상'] ? `(예상 ${cv['손익예상']}건 포함)` : ''}`,
        value: lack == null ? '근거 부족 —' : `근거 부족 ${lack}${total ? '/' + total : ''}${unit}`, warn: lack > 0 }));
    }
    coverage.append(cl);
    const freightReasons = Object.entries(cv['운임부족사유'] || {}).map(([reason, count]) => `${reason} ${count}개`);
    if (freightReasons.length) coverage.append(node('p', 'hl-note', `운임 근거가 부족한 이유: ${freightReasons.join(' · ')}`));
    coverage.append(node('p', 'hl-note', `마지막 검사 ${h.monitor?.scanned_at ? when(h.monitor.scanned_at) : '아직 안 함'} · AI 모델 호출 ${h.monitor?.llm_calls ?? '—'}회`));
    // 다른 쿠팡 판매 계정(2026-11-13 다중 계정) — 키로 상품을 읽었는지·심사·반려·30일 주문. 계정이 바른청년뿐이면 안 보임
    if ((h.accounts || []).length) {
      const ac = section('판매 계정', '바른청년 말고 키를 넣은 쿠팡 계정이에요. 상품은 15분마다, 주문은 바른청년과 같이 읽어요.'); ac.id = 'acct-sec';
      statusList(ac, 'acct-ok', h.accounts.map((a) => {
        const bad = a.ok === false || (a.problems || []).length;
        const parts = a.ok === false ? [`상품을 읽지 못했어요(${window.plainText ? window.plainText(a.error || '') : (a.error || '')})`] : [`상품 ${a.products}`, `판매 중 ${a.selling}`, a.review ? `심사 ${a.review}` : '', a.rejected ? `반려 ${a.rejected}` : '', `30일 주문 ${a.orders30}`];
        if ((a.problems || []).length) parts.push(`채울 것: ${a.problems.join(', ')}`);
        return { dot: bad ? 'warn' : 'ok', label: `쿠팡·${a.label}`, ok: !bad, warn: !!bad, value: parts.filter(Boolean).join(' · ') + (a.at ? ` · ${at(a.at)}` : '') };
      }), '개', h.accounts.map((a) => a.at || '').sort().pop());
      ac.append(action('계정 설정 열기', 'settings', 'acct-settings'));
    }
    const freshness = section('화면 자료', '못 읽은 자료는 마지막으로 읽은 값을 보여 줘요');
    const secs = Object.entries(s.sections || {});
    const lastRead = secs.map(([, v]) => v.last_ok || '').sort().pop();
    statusList(freshness, 'sections-ok', secs.map(([k, v]) => ({ dot: v.state === 'ok' ? 'ok' : 'warn', label: names[k] || k, ok: v.state === 'ok',
      value: v.state === 'ok' ? `최신${v.last_ok ? ' · ' + at(v.last_ok) : ''}` : v.last_ok ? `마지막으로 읽음 ${when(v.last_ok)}` : '아직 못 읽음' })), '개', lastRead);
    for (const key of Object.keys(h.errors || {})) freshness.append(node('p', 'hl-err', `${{ queue: '대기열', monitor: '감시', incidents: '복구' }[key] || key} 자료를 읽지 못했어요. 잠시 뒤 다시 읽어요.`));
    p.replaceChildren(fragment);
    if (focused?.isConnected) focused.focus({ preventScroll: true });
  }
  window.barunHealth = draw;
  document.addEventListener('barun:page', () => { if (current) draw(current); });   // 2026-11-06: 이 이벤트는 document에서만 나서(버블 없음) window 듣기는 한 번도 안 불렸음
  if (window.barunState) draw(window.barunState);
})();
