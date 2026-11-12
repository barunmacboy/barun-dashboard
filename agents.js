// 사무실 그림 위 말풍선·대기 꼬리표·알바 자리 모양 — office.js가 그리는 .bub·.qtag 글자 꼴만 둔다.
// 2026-10-22 15:33 사장님 "디스코드를 통해 만들어진 에이전트 작업 현황만 … 깔끔하게" → 직원·스크립트·대기열·멈춤 버튼 목록(에이전트 카드)은 뺐다.
// 디스코드 일 목록은 '맡긴 일' 화면(tasks.js), 정기 회차는 '회차·허브' 화면 '자동작업' 표. 멈춤·재개 API(core/agents.py)는 그대로 남아 있음.
// 2026-11-12 리뉴얼: 글자 11.5px 이상, 색은 공용 토큰만(어두운 화면에서도 맞게).
(() => {
  const css = document.createElement('style');
  css.textContent = `
    .room .st .bub { position: absolute; left: 50%; bottom: 100%; transform: translate(-50%, -4px); white-space: nowrap; font-size: 11.5px; line-height: 16px; font-weight: 600;
      padding: 0 6px; border-radius: 6px; background: var(--blue); color: #fff; pointer-events: none; z-index: 2; box-shadow: 0 1px 3px rgba(0, 0, 0, .14); }
    .room .st .qtag { position: absolute; right: -8px; bottom: -4px; font-size: 11.5px; line-height: 16px; font-weight: 600; padding: 0 4px; border-radius: 6px;
      background: var(--orange-bg); color: var(--orange-ink); box-shadow: inset 0 0 0 1px var(--orange); pointer-events: none; white-space: nowrap; }
    .room .st[data-seat^="alba:"] .tag { background: var(--orange-bg); color: var(--orange-ink); }`;
  document.head.append(css);
})();
