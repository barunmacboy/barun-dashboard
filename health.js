/* 운영 건강 화면: 장애, 복구 검증, 자료 신선도와 확인 범위를 한곳에 보여 준다. */
(() => {
  const $ = id => document.getElementById(id);
  const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const go = (text, page) => { const b = node('button', 'btn sm', text); b.type = 'button'; b.onclick = () => window.showTab(page); return b; };
  const names = { jobs: '자동작업', heartbeats: '진행 신호', hub: '감시 허브', worklog: '작업 일지', events: '알림', git: '변경 기록', backup: '백업', tasks: '맡긴 일', improve: '개선 기록', issues: '할 일', board: '일 보드', barund: '실행 대기열', usage: '사용량', savings: '절감 효과', operations: '운영 건강', status_md: '운영 메모', invoices: '인보이스', team: '담당자', approvals: '승인 대기' };
  let current;
  function draw(s) {
    current = s;
    const p = $('p-health'); if (!p) return;
    const h = s.operations || {}, incidents = h.incidents || [];
    const failed = Object.entries(s.sections || {}).filter(([, v]) => v.state !== 'ok');
    const notice = $('connection-notice');
    if (notice) { notice.hidden = !failed.length; notice.textContent = failed.length ? `일부 자료를 다시 확인하고 있어요 · ${failed.map(([k]) => names[k] || k).join(', ')}. 마지막 정상 자료는 유지됩니다.` : ''; }
    if (failed.length) { const hp = $('health'); hp.className = 'health warn'; hp.querySelector('.htxt').textContent = '자료 확인 중'; }
    const brief = $('health-preview');
    if (brief) {
      brief.replaceChildren(node('div', 'card-h', '운영 건강'));
      brief.append(node('p', 'lead', incidents.length ? `조사·재확인 ${incidents.filter(x => ['open','held'].includes(x.state)).length} · 복구 검증 ${incidents.filter(x => x.state === 'verifying').length} · 판단 필요 ${incidents.filter(x => x.state === 'stuck').length}` : '열린 복구 사건이 없어요'));
      brief.append(node('p', 'muted small', '실행 요청과 복구 완료를 구분하고, 근거가 부족한 항목도 함께 확인해요.'), go('운영 건강 확인', 'health'));
    }
    const opened = new Set([...p.querySelectorAll('details[open][data-incident]')].map(x => x.dataset.incident));
    p.replaceChildren();
    const intro = node('section', 'card');
    intro.append(node('h2', '', '문제 발견부터 복구 확인까지'), node('p', 'lead', '자동 조치 → 정상 동작 확인 → 해결. 반복되거나 확인되지 않으면 원인 조사로 이어집니다.'));
    const counts = node('div', 'stats');
    for (const [label, val, desc] of [['조사·재확인', incidents.filter(x => ['open', 'held'].includes(x.state)).length, '담당자가 원인을 확인해요'], ['복구 검증', incidents.filter(x => x.state === 'verifying').length, '실제 정상 동작을 확인해요'], ['판단 필요', incidents.filter(x => x.state === 'stuck').length, '다음 조치를 정해야 해요']]) {
      const n = node('div', 'stat'); n.append(node('div', 'k', label), node('div', 'v', val), node('div', 'd', desc)); counts.append(n);
    }
    intro.append(counts); p.append(intro);
    const section = (title, desc) => { const c = node('section', 'card'), hh = node('div', 'card-h'); hh.append(node('h2', '', title)); if (desc) hh.append(node('span', 'desc', desc)); c.append(hh); p.append(c); return c; };
    const service = section('감시 기능의 동작 상태', '감지기가 연결되어 있는지 보여 줘요. 업무별 실행 결과는 실행 내역에서 확인해요.');
    const list = node('ul', 'sys');
    const sources = h.hub?.sources || {};
    for (const v of Object.values(sources)) { const li = node('li'); li.append(node('span', 'dot ' + (v.ok ? 'ok' : v.paused ? '' : 'warn')), node('span', '', v.label), node('span', 'muted small', v.paused ? '운영 시간 밖' : v.ok ? '정상' : v.fails ? `연속 실패 ${v.fails}회` : '확인 지연')); list.append(li); }
    const q = h.queue || {}; const qa = q.at && Date.now() - Date.parse(q.at) < 120000;
    const li = node('li'); li.append(node('span', 'dot ' + (qa ? 'ok' : 'warn')), node('span', '', '실행 대기열'), node('span', 'muted small', qa ? '정상' : '확인 필요')); list.append(li);
    service.append(list, go('실행 내역 보기', 'work'));
    const issues = section('복구가 필요한 일', '현재 상태와 다음 조치');
    if (!incidents.length) issues.append(node('p', 'empty', s.sections?.operations?.state !== 'ok' || h.errors?.incidents ? '복구 상태를 아직 확인하지 못했어요' : '열린 복구 사건이 없어요'));
    for (const i of incidents) { const row = node('article', 'todo open'); row.append(node('span', 'badge', i.label), node('h3', 't', i.title), node('p', 'what', i.next)); const detail = node('details'); detail.dataset.incident = i.id; detail.open = opened.has(i.id); detail.append(node('summary', '', `근거와 이력 · 재발 ${i.recur}회 · 맡긴 횟수 ${i.tries}회`), node('pre', '', i.detail)); row.append(detail); issues.append(row); }
    if (incidents.some(i => i.state === 'stuck')) issues.append(go('판단할 카드 보기', 'todo'));
    const cv = h.monitor?.coverage || {}, coverage = section('감시가 확인할 수 있는 범위', '근거 부족은 정상 판정이 아니에요');
    for (const [kind, unit] of [['운임', '개'], ['손익', '건']]) coverage.append(node('p', '', `${kind} · 비교 ${cv[kind + '비교'] ?? '—'}${unit} / 근거 부족 ${cv[kind + '근거부족'] ?? '—'}${unit}`));
    coverage.append(node('p', 'muted small', `마지막 검사 ${h.monitor?.scanned_at?.replace('T', ' ') || '확인 전'} · 규칙 감시의 모델 호출 ${h.monitor?.llm_calls ?? '—'}회`));
    const freshness = section('화면 자료의 갱신 상태', '조회 실패 시 마지막 정상값을 보여 줍니다');
    const ul = node('ul', 'sys');
    for (const [k, v] of Object.entries(s.sections || {})) { const r = node('li'); r.append(node('span', 'dot ' + (v.state === 'ok' ? 'ok' : 'warn')), node('span', '', names[k] || k), node('span', 'muted small', v.state === 'ok' ? '최신 확인' : v.last_ok ? `마지막 정상 ${v.last_ok.slice(11)}` : '아직 확인 못함')); ul.append(r); }
    freshness.append(ul);
    for (const key of Object.keys(h.errors || {})) freshness.append(node('p', 'warn', `${{queue:'대기열',monitor:'감시',incidents:'복구'}[key] || key} 자료를 읽지 못했어요`));
  }
  window.barunHealth = draw;
  window.addEventListener('barun:page', () => { if (current) draw(current); });
  if (window.barunState) draw(window.barunState);
})();
