// 사무실 그림 위 말풍선·대기 꼬리표·알바 자리 모양 — office.js가 그리는 .bub·.qtag 글자 꼴만 둔다.
// 2026-10-22 15:33 사장님 "디스코드를 통해 만들어진 에이전트 작업 현황만 … 깔끔하게" → 직원·스크립트·대기열·멈춤 버튼 목록(🤖 에이전트 카드)은 뺐다.
// 디스코드 일 목록은 '맡긴 일' 화면(tasks.js), 정기 회차는 '회차·허브' 화면 '자동작업' 표. 멈춤·재개 API(core/agents.py)는 그대로 남아 있음.
(() => {
  const css = document.createElement('style');
  css.textContent = `
    .room .st .bub { position: absolute; left: 50%; bottom: 100%; transform: translate(-50%, -2px); white-space: nowrap; font-size: 10px; line-height: 1;
      padding: 3px 5px; border-radius: 6px; background: var(--blue); color: #fff; pointer-events: none; z-index: 2; }
    .room .st .qtag { position: absolute; right: -6px; bottom: -2px; font-size: 9px; line-height: 1; padding: 2px 4px; border-radius: 5px;
      background: var(--orange-bg); color: var(--orange-ink); border: 1px solid var(--orange); pointer-events: none; white-space: nowrap; }
    .room .st[data-seat^="alba:"] .tag { background: #fff4dc; color: #8a4b00; }`;
  document.head.append(css);
})();
