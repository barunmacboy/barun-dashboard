// 업무 흐름 화면 — 상품 소싱부터 배송·사후까지 14단계를 한 장에: 단계마다 무엇이(주문·상품 하나하나) 있고, 누가(에이전트·스크립트) 무엇을 하고,
// 무엇이 사람을 기다리는지(2026-10-25 사장님: "개별 주문건이나 업무를 객체화해서 … 각 워크플로에서 지금 어떤 에이전트가 어떤 일을 하고 있고 펜딩중인게 뭔지 한눈에").
// 읽기: GET /api/flow(dashboard/flow.py) · 객체 하나가 지나온 길 GET /api/flow/obj?k=&id= — 화면이 보이는 동안 20초마다.
// 버튼(2026-10-25 사장님 "개선해"): 사람 차례 카드 서랍(승인·선택·처리함·미룸·칸 옮기기) · 주문 서랍(이 단계 시트 칸 고치기·처리 방식) · 보낸 문의 상태
// — 모두 할 일·주문 데이터 화면과 같은 POST /api/action(누른 사람 이름으로 기록, 시트는 회차 중이면 기다림).
// 자리: index.html의 #p-flow를 채운다(보임·숨김은 'barun:page' 이벤트).
// 2026-11-12 리뉴얼: 화면 글 해요체·공용 숫자 칸(.stats)·영어 코드는 koLabel로, 빈 단계는 작은 칸으로, 칸반 좌우 넘김 버튼·가장자리 그림자.
(() => {
  const $ = (id) => document.getElementById(id);
  const E = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const LV = ['사람', '자료만', '반자동', '자동', '완전 자동'];
  const LVC = ['var(--st-crit)', 'var(--st-serious)', 'var(--st-warn)', 'var(--st-run)', 'var(--st-good)'];
  const AST = { running: ['일하는 중', 'run'], watching: ['지켜보는 중', 'watch'], queued: ['차례 기다림', 'wait'], paused: ['멈춤', 'stop'], idle: ['쉬는 중', ''] };
  const ic = (name, cls) => { const e = E('span', 'fi' + (cls ? ' ' + cls : '')); e.innerHTML = window.ico ? window.ico(name) : ''; return e; };
  const noE = (t) => (window.noEmoji ? window.noEmoji(t) : String(t ?? ''));
  // 영어 상태 코드·택배사 코드 → 한국어(index.html koLabel), '배송중'은 '배송 중'으로 같은 말
  const ko = (t) => { const v = noE(t); return (window.koLabel ? window.koLabel(v) : v).replace(/배송중/g, '배송 중'); };
  // 담당 이름은 역할만: '② 해외송장·배대지(예외 처리반)' → '② 해외송장·배대지', '① 결제·송장 스크립트' → '① 결제·송장 자동'
  const role = (n) => noE(n).replace(/\s*\([^)]*\)/g, '').replace(/\s*스크립트$/, ' 자동').trim();
  const hum = (tag, cls, n, label) => { const e = E(tag, cls); e.append(ic('hand'), document.createTextNode(`${label || ''}${n}`)); e.title = `사람 차례 카드 ${n}장`; return e; };
  const CST = { waiting_human: '사람 확인', waiting_approval: '승인 대기', snoozed: '미룸' };
  const PAST = { ...CST, done: '완료', resolved: '완료', running: '진행 중', queued: '대기', failed: '실패', cancelled: '취소', open: '열림', ack: '보는 중' };
  const NVS = { OUTOFSTOCK: '품절', SUSPENSION: '판매중지', PROHIBITION: '판매금지', SALE: '판매 중' };
  const ONLY = [['', '전체'], ['late', '기한 지남'], ['human', '사람 차례'], ['stuck', '오래 머묾']];
  const PLAT = [['', '모든 플랫폼'], ['쿠팡', '쿠팡'], ['네이버', '네이버']];
  // 판매 계정이 둘 이상이면 쿠팡 계정마다 거르기(2026-11-13 다중 계정) — 값 '@<계정>'(바른청년은 '@')
  const platOpts = () => (window.multiAcct && window.multiAcct() ? [...PLAT, ...window.BARUN_ACCTS.map((a) => ['@' + a.name, `쿠팡·${a.label}`])] : PLAT);
  const LIMIT = () => (NARROW.matches ? 20 : 40);       // 칸마다 따로 스크롤 — 그 아래는 '더 보기'
  const NARROW = matchMedia('(max-width: 760px)');
  let data = null, timer = 0, busy = false, shown = false, openObj = null, lastFocus = null, seqN = 0, applied = 0;
  const flt = { q: '', only: '', plat: '' };
  const more = {};            // 단계 → 다 보기
  let prevStage = {};         // 객체 → 지난번 단계(옮겨 온 것 반짝)
  const opened = {};          // 빈 단계 칸 → 펼침
  let lane = 'order'; try { lane = localStorage.getItem('barun.flowLane') || 'order'; } catch (e) { /* 무시 */ }
  const setLane = (id) => { lane = id; try { localStorage.setItem('barun.flowLane', id); } catch (e) { /* 무시 */ } };

  const won = (n) => `${(+n || 0).toLocaleString('ko-KR')}원`;
  const T = (iso) => { if (!iso) return null; const d = new Date(String(iso).slice(0, 19)); return isNaN(d) ? null : d; };
  const stamp = (iso) => (iso ? String(iso).slice(5, 16).replace('T', ' ').replace('-', '/') : '');   // 갱신 표시 — 현황판 공통 '11/12 23:23 갱신'
  // 2026-11-06: 서버 시각은 시간대 없는 한국 시각인데 기기 시계와 바로 비교해서, 한국 밖·시계 어긋난 기기는 '9시간 전'·'내일'로 틀렸음
  //   → 서버 at과 기기 시계 차이를 15분 단위로 맞춰 둠(캐시 몇 초 차이는 무시)
  let skew = 0;
  const nowD = () => new Date(Date.now() - skew);
  function when(iso) {          // 방금 · 12분 전 · 오늘 20:50 · 어제 20:50 · 내일 08:00 · 10-22 20:50
    const d = T(iso); if (!d) return '';
    const n = nowD(), s = (n - d) / 1000;
    if (s >= 0 && s < 60) return '방금';
    if (s >= 0 && s < 3600) return `${Math.floor(s / 60)}분 전`;
    const hm = d.toTimeString().slice(0, 5), day = Math.round((new Date(n.toDateString()) - new Date(d.toDateString())) / 864e5);
    return day === 0 ? `오늘 ${hm}` : day === 1 ? `어제 ${hm}` : day === -1 ? `내일 ${hm}` : `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hm}`;
  }
  const stay = (d) => (d == null ? '' : d < 1 ? '오늘 들어옴' : d >= 365 ? `${Math.floor(d / 365)}년 넘게` : `${Math.floor(d)}일째`);
  const secs = (s) => (s == null ? '' : s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor(s % 3600 / 60)}분째` : s >= 60 ? `${Math.floor(s / 60)}분째` : `${s}초째`);

  function install() {
    const sec = $('p-flow'); if (!sec || sec.dataset.ready) return !!sec; sec.dataset.ready = '1';
    const css = E('style'); css.textContent = `
      .fi { display: inline-flex; align-items: center; flex: none; line-height: 1; } .fi .ic { width: 1.05em; height: 1.05em; }
      .fl-kpis .stat { background: var(--card); } .fl-kpis .stat:hover { background: var(--hover); }
      .fl-kpis .stat[aria-pressed="true"] { box-shadow: inset 0 0 0 2px var(--blue); }
      .fl-kpis .stat:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
      @media (min-width: 1180px) { .fl-kpis { grid-template-columns: repeat(6, minmax(0, 1fr)); } }

      /* 찾기·거르기 한 줄 — 찾기 칸 36px · 칩·나눔 단추 32px */
      .fl-tools { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; }
      .fl-search { flex: 1 1 240px; min-width: 0; position: relative; display: flex; align-items: center; }
      .fl-search > .fi { position: absolute; left: 12px; color: var(--muted); pointer-events: none; } .fl-search > .fi .ic { width: 16px; height: 16px; }
      .fl-q { width: 100%; min-width: 0; height: 36px; border: 0; border-radius: var(--r-sm); background: var(--fill); color: var(--ink); padding: 0 12px 0 36px; font: inherit; font-size: 14px; }
      .fl-q::placeholder { color: var(--muted); }
      .fl-q:focus { outline: 2px solid var(--blue); outline-offset: 0; background: var(--card); }
      .fl-chips { display: inline-flex; flex-wrap: wrap; gap: 4px; min-width: 0; }
      .fl-chip { all: unset; box-sizing: border-box; height: 32px; padding: 0 12px; border-radius: 999px; background: var(--fill); color: var(--ink2); font-size: 13px; font-weight: 600;
        cursor: pointer; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; transition: background-color .18s var(--ease), color .18s var(--ease); }
      .fl-chip:hover { background: var(--hover); } .fl-chip:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
      .fl-chip[aria-pressed="true"] { background: var(--blue); color: #fff; }
      /* 플랫폼은 칩과 모양을 달리(나눔 단추) — 두 거르기 묶음이 한 덩어리로 보이던 것 */
      .fl-seg { display: inline-flex; background: var(--fill); border-radius: var(--r-sm); padding: 2px; gap: 2px; max-width: 100%; overflow-x: auto; }
      .fl-seg button { all: unset; box-sizing: border-box; height: 28px; padding: 0 12px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--sub); cursor: pointer;
        white-space: nowrap; display: inline-flex; align-items: center; transition: background-color .18s var(--ease), color .18s var(--ease); }
      .fl-seg button:hover { color: var(--ink); } .fl-seg button:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
      .fl-seg button[aria-pressed="true"] { background: var(--card); color: var(--ink); box-shadow: 0 1px 2px rgba(0, 0, 0, .1); }
      .fl-upd { margin-left: auto; display: inline-flex; align-items: center; min-height: 32px; font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; min-width: 0; }
      .fl-upd.err { color: var(--red-ink); }

      /* 흐름 지도 — 14단계 한 줄(노선도). 색 규칙 하나: 빨강 테두리 = 기한 지난 것 있음, 파랑 = 일하는 중 */
      .fl-map { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); padding: 16px 16px 12px; overflow-x: auto; }
      .fl-map-lanes { display: flex; min-width: 960px; font-size: 12px; color: var(--muted); font-weight: 600; margin-bottom: 8px; }
      .fl-map-lanes span { border-bottom: 2px solid var(--line); padding-bottom: 4px; margin-right: 8px; }
      .fl-map-row { display: flex; align-items: flex-start; min-width: 960px; }
      .fl-node { all: unset; box-sizing: border-box; flex: 0 0 64px; display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; text-align: center;
        border-radius: var(--r-sm); padding: 4px 0 8px; transition: background-color .18s var(--ease); }
      .fl-node:hover { background: var(--hover); } .fl-node:focus-visible { outline: 2px solid var(--blue); outline-offset: 1px; }
      .fl-node .c { width: 36px; height: 36px; border-radius: 50%; background: var(--card); border: 2px solid var(--line); display: grid; place-items: center;
        font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; position: relative; color: var(--muted); }
      .fl-node.has .c { color: var(--ink); border-color: var(--axis); }
      .fl-node.run .c { border-color: var(--st-run); color: var(--blue-ink); }
      .fl-node.hot .c { border-color: var(--st-crit); color: var(--red-ink); }
      .fl-node.run .c::after { content: ""; position: absolute; inset: -6px; border-radius: 50%; border: 2px solid var(--st-run); animation: fl-ping 1.6s var(--ease-out) infinite; }
      .fl-node .nm { font-size: 12px; line-height: 16px; min-height: 32px; color: var(--ink2); word-break: keep-all; max-width: 62px; }
      .fl-node .n { font-size: 12px; line-height: 16px; color: var(--muted); }
      .fl-node .b { display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; min-height: 20px; }
      .fl-node .b i { font-style: normal; font-size: 12px; line-height: 20px; padding: 0 6px; border-radius: 6px; background: var(--fill); color: var(--sub); white-space: nowrap;
        display: inline-flex; align-items: center; gap: 2px; }
      .fl-node .b i.h { background: var(--blue-bg); color: var(--blue-ink); } .fl-node .b i.l { background: var(--red-bg); color: var(--red-ink); }
      .fl-node .b i.in { display: none; background: transparent; color: var(--blue-ink); font-weight: 600; }   /* 휴대폰은 단계 사이 선이 없어 '+n'을 칸 안에 */
      .fl-link { flex: 1 1 8px; min-width: 8px; height: 2px; background: var(--line); margin-top: 21px; position: relative; }
      .fl-link.gap { background: repeating-linear-gradient(90deg, var(--line) 0 4px, transparent 4px 8px); }
      .fl-link i { position: absolute; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: var(--st-run); animation: fl-move 2.4s linear infinite; }
      .fl-link b { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 12px; color: var(--blue-ink); font-weight: 600; white-space: nowrap; cursor: help; }
      .fl-map-foot { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--line); }
      .fl-map-side { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 12px; color: var(--muted); }
      .fl-sn { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 8px; height: 28px; padding: 0 12px; border-radius: 999px; background: var(--fill2);
        color: var(--ink2); cursor: pointer; font-size: 12.5px; transition: background-color .18s var(--ease); }
      .fl-sn:hover { background: var(--hover); } .fl-sn:focus-visible { outline: 2px solid var(--blue); outline-offset: 1px; }
      .fl-sn b { font-variant-numeric: tabular-nums; } .fl-sn .h { color: var(--blue-ink); display: inline-flex; align-items: center; gap: 2px; }
      .fl-sn.run { box-shadow: inset 0 0 0 2px var(--st-run); } .fl-sn.hot { box-shadow: inset 0 0 0 2px var(--st-crit); }
      .fl-mlg { margin-left: auto; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--muted); }
      .fl-mlg span { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
      .fl-mlg .ring { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--st-crit); } .fl-mlg .ring.run { border-color: var(--st-run); }
      .fl-mlg b { color: var(--blue-ink); font-weight: 600; }
      @keyframes fl-ping { from { opacity: .9; transform: scale(.85); } to { opacity: 0; transform: scale(1.25); } }
      @keyframes fl-move { from { left: 0; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } to { left: calc(100% - 8px); opacity: 0; } }

      /* 칸반 — 레인 탭 → 단계 칸(머리 고정·칸마다 스크롤) → 카드 (2026-10-25 사장님 "칸반의 형태를 더 발전") */
      .fl-board { background: var(--card); border: 1px solid var(--line); border-radius: var(--r); min-width: 0; }
      .fl-bh { display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; padding: 12px 16px 0; }
      .fl-tabs { display: inline-flex; background: var(--fill); border-radius: 12px; padding: 4px; gap: 4px; max-width: 100%; overflow-x: auto; }
      .fl-tab { all: unset; box-sizing: border-box; flex: none; height: 32px; padding: 0 12px; border-radius: 8px; font-size: 13.5px; font-weight: 600; color: var(--sub); cursor: pointer;
        display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; transition: background-color .18s var(--ease), color .18s var(--ease); }
      .fl-tab b { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--muted); }
      .fl-tab .h { color: var(--blue-ink); font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; gap: 2px; } .fl-tab .h .fi { display: none; }
      .fl-tab:hover { color: var(--ink); } .fl-tab:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }
      .fl-tab[aria-selected="true"] { background: var(--card); color: var(--ink); box-shadow: 0 1px 2px rgba(0, 0, 0, .1); } .fl-tab[aria-selected="true"] b { color: var(--blue-ink); }
      .fl-bh .d { font-size: 12.5px; color: var(--muted); flex: 1 1 160px; min-width: 0; }
      .fl-nav { display: inline-flex; gap: 4px; margin-left: auto; } .fl-nav[hidden] { display: none; }
      .fl-nav button { all: unset; box-sizing: border-box; width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center; background: var(--fill); color: var(--ink2);
        cursor: pointer; transition: background-color .18s var(--ease), opacity .18s var(--ease); }
      .fl-nav button:hover { background: var(--hover); } .fl-nav button:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
      .fl-nav button:disabled { opacity: .35; cursor: default; }
      /* 옆으로 더 있으면 가장자리에 그림자(옅은 흐림만으론 더 있는지 몰랐음) */
      .fl-cw { position: relative; min-width: 0; }
      .fl-cw::before, .fl-cw::after { content: ""; position: absolute; top: 12px; bottom: 16px; width: 28px; pointer-events: none; opacity: 0; z-index: 2; transition: opacity .2s var(--ease); }
      .fl-cw::before { left: 0; background: linear-gradient(90deg, color-mix(in srgb, var(--ink) 14%, transparent), transparent); }
      .fl-cw::after { right: 0; background: linear-gradient(270deg, color-mix(in srgb, var(--ink) 14%, transparent), transparent); }
      .fl-cw.fade-l::before, .fl-cw.fade-r::after { opacity: 1; }
      .fl-cols { position: relative; display: flex; gap: 12px; overflow-x: auto; padding: 12px 16px 16px; scroll-snap-type: x proximity; scroll-padding-inline: 16px; align-items: flex-start;
        height: clamp(520px, calc(100dvh - 200px), 1000px); }
      .fl-col { flex: 1 0 272px; max-width: 440px; align-self: stretch; background: var(--fill2); border-radius: var(--r-sm); scroll-snap-align: start; display: flex; flex-direction: column;
        min-width: 0; min-height: 0; box-shadow: inset 0 3px 0 transparent; overflow: hidden; }
      .fl-col.late { box-shadow: inset 0 3px 0 var(--st-crit); } .fl-col.stuck { box-shadow: inset 0 3px 0 var(--st-warn); } .fl-col.run { box-shadow: inset 0 3px 0 var(--st-run); }
      .fl-col.flash { animation: fl-flash 1.6s var(--ease-out); }
      @keyframes fl-flash { from { outline: 3px solid var(--blue); } to { outline: 3px solid transparent; } }
      /* 빈 단계 = 위에 붙은 작은 칸 '이름 · 0건'(2026-11-12 점검: 0만 든 키 큰 회색 칸) — 누르면 펼침 */
      .fl-col.shut { all: unset; box-sizing: border-box; flex: 0 0 120px; align-self: flex-start; background: var(--fill2); border-radius: var(--r-sm); display: grid;
        grid-template-columns: auto minmax(0, 1fr); gap: 4px 8px; align-items: center; padding: 12px; cursor: pointer; scroll-snap-align: start; transition: background-color .18s var(--ease); }
      .fl-col.shut.run { box-shadow: inset 0 3px 0 var(--st-run); }
      .fl-col.shut:hover { background: var(--hover); } .fl-col.shut:focus-visible { outline: 2px solid var(--blue); }
      .fl-col.shut .vn { font-size: 13px; color: var(--sub); line-height: 1.35; min-width: 0; }
      .fl-col.shut .z { grid-column: 1 / -1; font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
      .fl-ch { padding: 12px 12px 8px; display: grid; gap: 8px; border-bottom: 1px solid var(--line); flex: none; }
      .fl-ch .t { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .fl-ch h3 { margin: 0; font-size: 14.5px; font-weight: 700; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fl-ct { flex: none; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; background: var(--card); border-radius: 999px; padding: 0 8px; line-height: 24px; color: var(--ink2); }
      .fl-col.shut .no, .fl-ch .no { flex: none; width: 24px; height: 24px; border-radius: 50%; background: var(--card); border: 1px solid var(--line); display: grid; place-items: center;
        font-size: 12px; font-weight: 700; color: var(--sub); }
      .fl-lv { font-size: 12px; color: var(--sub); display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
      .fl-lv i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .fl-flags { display: flex; flex-wrap: wrap; gap: 4px; }
      .fl-tag { font-size: 12px; line-height: 20px; padding: 0 8px; border-radius: 6px; background: var(--card); color: var(--sub); white-space: nowrap; display: inline-flex; align-items: center; gap: 2px; }
      .fl-tag.l { background: var(--red-bg); color: var(--red-ink); } .fl-tag.s { background: var(--orange-bg); color: var(--orange-ink); }
      .fl-tag.h { background: var(--blue-bg); color: var(--blue-ink); } .fl-tag.g { background: var(--green-bg); color: var(--green-ink); }
      .fl-bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: var(--line); gap: 1px; }
      .fl-bar b { display: block; height: 100%; }
      .fl-legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--sub); }
      .fl-legend span { display: inline-flex; align-items: center; gap: 4px; } .fl-legend i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
      .fl-who { display: grid; gap: 4px; }
      .fl-ac { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--sub); min-width: 0; }
      .fl-ac .nm { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fl-ac .w { flex: none; color: var(--muted); font-variant-numeric: tabular-nums; }
      .fl-ac.run { color: var(--blue-ink); font-weight: 600; } .fl-ac.run .w { color: var(--blue-ink); }
      .fl-ac.fail .w { color: var(--red-ink); }
      .fl-body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 8px 12px; display: flex; flex-direction: column; gap: 8px; }   /* 칸 끝에 닿으면 화면이 넘어감(2026-11-13 갇힘 정리) */
      /* 칸 아래로 더 있으면 끝을 흐리게(카드가 줄 가운데서 잘려 보이던 것) */
      .fl-body.fade-b { -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 40px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 40px), transparent); }
      /* 휴대폰·터치(2026-11-13 '스크롤이 안되는 화면'): 칸마다 안에서 넘기면 손가락이 칸에 갇혀 화면이 안 내려감 → 칸은 내용만큼 길게, 화면이 넘어감.
         옆으로는 칸 하나씩 붙어 넘어감(휴대폰 칸 폭은 아래 좁은 화면 절) */
      @media (max-width: 1023px), (pointer: coarse) {
        .fl-cols { height: auto; scroll-snap-type: x mandatory; }
        .fl-col { align-self: flex-start; }
        .fl-body { overflow: visible; }
        .fl-body.fade-b { -webkit-mask-image: none; mask-image: none; }
      }
      .fl-body > details { background: var(--card); border-radius: var(--r-sm); padding: 8px 12px; font-size: 12px; }
      .fl-body > details > summary { color: var(--sub); font-weight: 600; font-size: 12.5px; padding: 0; }
      .fl-body > details[open] { display: grid; gap: 8px; } .fl-body > details .fl-ag { background: var(--fill2); }
      .fl-sec { font-size: 12px; font-weight: 700; color: var(--muted); margin: 4px 4px 0; display: flex; align-items: center; gap: 4px; }
      .fl-ag { background: var(--card); border-radius: var(--r-sm); padding: 8px 12px; font-size: 12px; line-height: 1.45; min-width: 0; }
      .fl-ag .t { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--ink2); min-width: 0; }
      .fl-ag .t span.nm { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fl-st { flex: none; font-size: 12px; font-weight: 600; padding: 0 8px; border-radius: 6px; background: var(--fill); color: var(--muted); white-space: nowrap; line-height: 20px; }
      .fl-st.run { background: var(--blue-bg); color: var(--blue-ink); } .fl-st.watch { background: var(--green-bg); color: var(--green-ink); }
      .fl-st.wait { background: var(--orange-bg); color: var(--orange-ink); } .fl-st.stop { background: var(--red-bg); color: var(--red-ink); }
      .fl-st.run::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: currentColor; margin-right: 4px; vertical-align: 1px; animation: fl-blink 1.2s var(--ease) infinite; }
      @keyframes fl-blink { 50% { opacity: .25; } }
      .fl-ag .d { color: var(--sub); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-top: 2px; }
      .fl-ag .d.fail { color: var(--red-ink); } .fl-ag .x { color: var(--muted); font-size: 12px; }
      .fl-hc { all: unset; box-sizing: border-box; display: block; width: 100%; background: var(--card); border-radius: var(--r-sm); padding: 8px 12px; font-size: 12.5px; cursor: pointer;
        box-shadow: inset 3px 0 0 var(--blue); line-height: 1.45; transition: background-color .18s var(--ease); }
      .fl-hc:hover { background: var(--hover); } .fl-hc:focus-visible { outline: 2px solid var(--blue); outline-offset: 1px; }
      .fl-hc .m { font-size: 12px; color: var(--muted); margin-top: 2px; } .fl-hc .m b { color: var(--blue-ink); font-weight: 600; } .fl-hc .m .ap { color: var(--orange-ink); }
      .fl-ob { all: unset; box-sizing: border-box; display: grid; gap: 2px; width: 100%; background: var(--card); border-radius: var(--r-sm); padding: 8px 12px; cursor: pointer;
        font-size: 12.5px; line-height: 1.45; position: relative; box-shadow: inset 0 0 0 1px transparent; transition: background-color .18s var(--ease), box-shadow .18s var(--ease); }
      .fl-ob:hover { background: var(--hover); box-shadow: inset 0 0 0 1px var(--line); } .fl-ob:focus-visible { outline: 2px solid var(--blue); outline-offset: 1px; }
      .fl-ob::before { content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px; border-radius: 2px; background: transparent; }
      .fl-ob.late::before { background: var(--st-crit); } .fl-ob.today::before { background: var(--st-serious); } .fl-ob.stuck::before { background: var(--st-warn); }
      .fl-ob.moved { animation: fl-flash 2s var(--ease-out); }
      .fl-ob .r1 { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .fl-ob .who { font-weight: 700; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1; }
      .fl-ob .pl { flex: none; font-size: 12px; font-weight: 600; padding: 0 6px; border-radius: 6px; line-height: 18px; }
      .fl-ob .pl.c { background: var(--red-bg); color: var(--red-ink); } .fl-ob .pl.n { background: var(--green-bg); color: var(--green-ink); }
      .fl-ob .du { flex: none; font-size: 12px; font-weight: 600; color: var(--muted); }
      .fl-ob .du.late { color: var(--red-ink); } .fl-ob .du.today, .fl-ob .du.soon { color: var(--orange-ink); }
      .fl-ob .nm { color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fl-ob .r3 { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; min-width: 0; }
      .fl-ob .r3 .sub { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fl-ob .r3 .h { color: var(--blue-ink); } .fl-ob .r3 .nx { color: var(--blue-ink); font-weight: 600; white-space: nowrap; }
      .fl-more { all: unset; box-sizing: border-box; text-align: center; padding: 8px; border-radius: var(--r-sm); font-size: 12.5px; font-weight: 600; color: var(--blue-ink); cursor: pointer;
        transition: background-color .18s var(--ease); }
      .fl-more:hover { background: var(--hover); } .fl-more:focus-visible { outline: 2px solid var(--blue); }
      .fl-empty { font-size: 12.5px; color: var(--muted); padding: 12px; text-align: center; background: var(--card); border-radius: var(--r-sm); }
      /* 2026-11-06: 흐름 지도가 오른쪽에서 잘려도 더 있다는 표시가 없었음 → 넘치는 쪽 가장자리 흐림 */
      .fl-map.fade-r, .fl-tabs.fade-r { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent); }
      .fl-map.fade-l, .fl-tabs.fade-l { -webkit-mask-image: linear-gradient(90deg, transparent, #000 40px); mask-image: linear-gradient(90deg, transparent, #000 40px); }
      .fl-map.fade-l.fade-r, .fl-tabs.fade-l.fade-r { -webkit-mask-image: linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 40px), transparent); mask-image: linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 40px), transparent); }
      .fl-info { background: var(--card); border-radius: var(--r-sm); padding: 8px 12px; font-size: 12px; color: var(--sub); line-height: 1.5; }
      .fl-info b { color: var(--ink2); font-variant-numeric: tabular-nums; }

      /* 아래: 오늘 움직인 주문 · 지금 하는 일과 다음 회차 */
      .fl-low { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 16px; }
      .fl-low ul { list-style: none; margin: 0; padding: 0; }
      .fl-low li { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 8px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 13px; align-items: baseline; }
      .fl-low li:first-child { border-top: 0; } .fl-low li.none { display: block; color: var(--muted); padding: 12px 0; }
      .fl-low .tm { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
      .fl-feed button { all: unset; cursor: pointer; border-radius: 6px; } .fl-feed button:hover { text-decoration: underline; } .fl-feed button:focus-visible { outline: 2px solid var(--blue); }
      .fl-feed .to { color: var(--blue-ink); font-weight: 600; }
      .fl-next .dot { margin-right: 6px; }

      /* 객체 자세히(오른쪽 서랍) */
      .fl-dr { position: fixed; top: 0; right: 0; bottom: 0; width: min(460px, 100vw); background: var(--card); box-shadow: var(--pop); z-index: 60; display: flex; flex-direction: column; }
      .fl-dr[hidden] { display: none; }
      .fl-dr-h { display: flex; align-items: flex-start; gap: 12px; padding: 16px 16px 12px; border-bottom: 1px solid var(--line); }
      .fl-dr-h h2 { margin: 0; font-size: 16.5px; font-weight: 700; letter-spacing: -.02em; flex: 1; min-width: 0; outline: none; }
      .fl-dr-h .sub { font-size: 13px; color: var(--sub); margin-top: 4px; font-weight: 400; letter-spacing: 0; }
      .fl-x { all: unset; flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; color: var(--sub); transition: background-color .18s var(--ease); }
      .fl-x:hover { background: var(--hover); } .fl-x:focus-visible { outline: 2px solid var(--blue); }
      .fl-dr-b { overflow-y: auto; padding: 16px 16px 24px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-content: start; }   /* 줄임표 글(카드 안 주문)이 서랍을 넓히지 않게 */
      .fl-now { background: var(--blue-bg); border-radius: 12px; padding: 12px 16px; font-size: 13.5px; line-height: 1.55; }
      .fl-now b { color: var(--blue-ink); } .fl-now.late { background: var(--red-bg); } .fl-now.late b { color: var(--red-ink); }
      .fl-steps { list-style: none; margin: 0; padding: 0; }
      .fl-steps li { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 4px 0; font-size: 13.5px; position: relative; }
      .fl-steps li::before { content: ""; position: absolute; left: 11px; top: -6px; height: 12px; width: 2px; background: var(--line); }
      .fl-steps li:first-child::before { display: none; }
      .fl-steps .mk { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; background: var(--fill); color: var(--muted); position: relative; z-index: 1; }
      .fl-steps li.done .mk { background: var(--green-bg); color: var(--green-ink); } .fl-steps li.done::before { background: var(--st-good); }
      .fl-steps li.now .mk { background: var(--blue); color: #fff; box-shadow: 0 0 0 4px var(--blue-bg); }
      .fl-steps li.now .nm { font-weight: 700; } .fl-steps li.next { color: var(--muted); }
      .fl-steps .at { font-size: 12px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .fl-kv { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 8px 12px; font-size: 13px; margin: 0; }
      .fl-kv dt { color: var(--muted); } .fl-kv dd { margin: 0; }
      .fl-dr h4 { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: var(--sub); }
      .fl-ev { list-style: none; margin: 0; padding: 0; font-size: 12.5px; }
      .fl-ev li { padding: 8px 0; border-top: 1px solid var(--line); display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px; }
      .fl-ev li:first-child { border-top: 0; } .fl-ev .tm { color: var(--muted); font-variant-numeric: tabular-nums; } .fl-ev .src { color: var(--muted); font-size: 12px; }
      .fl-acts { display: flex; flex-wrap: wrap; gap: 8px; }
      .fl-do { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(188px, 100%), 1fr)); gap: 8px; margin-bottom: 8px; }
      .fl-a { display: flex; gap: 8px; align-items: flex-start; text-align: left; padding: 8px 12px; border-radius: var(--r-sm); background: var(--fill2); border: 1px solid transparent;
        color: var(--ink); font: inherit; cursor: pointer; text-decoration: none; min-width: 0; transition: background-color .18s var(--ease), border-color .18s var(--ease); }
      .fl-a:hover { border-color: var(--line); background: var(--card); text-decoration: none; } .fl-a:focus-visible { outline: 2px solid var(--blue); outline-offset: 1px; }
      .fl-a > .fi { color: var(--sub); margin-top: 2px; flex: none; } .fl-a .tx { min-width: 0; display: grid; gap: 2px; }
      .fl-a b { font-size: 13px; font-weight: 600; } .fl-a small { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fl-a.main { background: var(--blue-bg); } .fl-a.main > .fi, .fl-a.main b { color: var(--blue-ink); }
      .fl-a[disabled] { opacity: .55; cursor: progress; }
      .fl-flash { animation: flflash 1.2s var(--ease-out); border-radius: var(--r-sm); }
      @keyframes flflash { from { box-shadow: 0 0 0 3px var(--blue); } to { box-shadow: 0 0 0 3px transparent; } }
      .fl-form { display: grid; gap: 8px; }
      .fl-form label { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px; align-items: center; font-size: 13px; color: var(--muted); }
      .fl-form input, .fl-form textarea { box-sizing: border-box; width: 100%; min-width: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: var(--ink);
        font: inherit; font-size: 13.5px; padding: 8px 12px; }
      .fl-form textarea { resize: vertical; min-height: 56px; line-height: 1.45; }
      .fl-sel, .fl-in { box-sizing: border-box; min-width: 0; height: 34px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: var(--ink); font: inherit; font-size: 13.5px; padding: 0 12px; }
      .fl-sel { flex: 1; padding: 0 8px; } .fl-in { flex: 1 1 140px; }
      .fl-form input:focus, .fl-form textarea:focus, .fl-sel:focus, .fl-in:focus { outline: 2px solid var(--blue); outline-offset: -1px; border-color: transparent; }
      .fl-form input.ch, .fl-form textarea.ch { border-color: var(--blue); background: var(--blue-bg); }
      .fl-out { font-size: 12.5px; line-height: 1.5; padding: 8px 12px; border-radius: 8px; background: var(--fill); color: var(--ink2); display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
      .fl-out.ok { background: var(--green-bg); color: var(--green-ink); } .fl-out.bad { background: var(--red-bg); color: var(--red-ink); }
      .fl-out[hidden] { display: none; }
      .fl-pre { margin: 0; white-space: pre-wrap; word-break: break-word; font: inherit; font-size: 12.5px; line-height: 1.55; color: var(--ink2); background: var(--fill2);
        border-radius: var(--r-sm); padding: 12px; max-height: 280px; overflow-y: auto; }
      .fl-todo { font-size: 13.5px; line-height: 1.5; background: var(--orange-bg); color: var(--orange-ink); border-radius: var(--r-sm); padding: 8px 12px; }
      .fl-objs { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; } .fl-objs .fl-ob { background: var(--fill2); }
      .fl-mv { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .fl-hs { display: flex; flex-wrap: wrap; gap: 8px; }
      .fl-hs .btn[aria-pressed="true"] { box-shadow: inset 0 0 0 2px var(--blue); }
      .fl-past { font-size: 12.5px; color: var(--sub); display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; padding: 4px 0; }
      .fl-past a { color: var(--blue-ink); }
      .fl-scrim { position: fixed; inset: 0; background: rgba(0, 0, 0, .35); z-index: 59; }
      .fl-scrim[hidden] { display: none; }
      @media (max-width: 1100px) { .fl-low { grid-template-columns: minmax(0, 1fr); } }
      @media (max-width: 760px) {
        /* 휴대폰: 흐름 지도는 옆으로 넘기지 않고 여러 줄로(마지막 단계가 잘려 안 보이던 것) */
        .fl-map { padding: 12px; overflow: visible; }
        .fl-map-lanes, .fl-link { display: none; }
        .fl-map-row { min-width: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 4px 0; }
        .fl-mlg { margin-left: 0; }
        .fl-bh { padding: 12px 12px 0; } .fl-bh .d { display: none; }
        .fl-tabs { flex: 1 1 auto; }
        .fl-cols { padding: 12px; gap: 8px; scroll-padding-inline: 12px; }
        .fl-node .b i.in { display: inline-flex; }
        .fl-col { flex: 0 0 84vw; max-width: none; }
        .fl-dr { width: 100vw; }
        .fl-form label { grid-template-columns: minmax(0, 1fr); gap: 4px; }
        .fl-upd { margin-left: 0; }
      }
      @media (max-width: 600px) { .fl-q, .fl-form input, .fl-form textarea, .fl-sel, .fl-in { font-size: 16px; } }   /* 아이폰이 입력칸을 누를 때 화면을 키우지 않게 */
      @media (max-width: 560px) { .fl-do { grid-template-columns: repeat(2, minmax(0, 1fr)); } .fl-a { padding: 8px; } .fl-a b { font-size: 12.5px; } }
      @media (max-width: 480px) { .fl-tab { padding: 0 8px; gap: 4px; } .fl-tab .h .lab { display: none; } .fl-tab .h .fi { display: inline-flex; } }
      @media (prefers-reduced-motion: reduce) { .fl-link i, .fl-node.run .c::after, .fl-st.run::before { animation: none; } .fl-link i { display: none; } .fl-ob.moved, .fl-col.flash, .fl-flash { animation: none; } }
    `;
    document.head.append(css);
    sec.innerHTML = `
      <div class="stats fl-kpis" id="fl-kpis"></div>
      <div class="fl-tools">
        <label class="fl-search" id="fl-search"><span class="sr-only">주문과 상품 찾기</span><input class="fl-q" id="fl-q" type="search" placeholder="받는 분, 상품, 주문번호"></label>
        <span class="fl-chips" role="group" aria-label="상태로 거르기" id="fl-only"></span>
        <span class="fl-seg" role="group" aria-label="플랫폼으로 거르기" id="fl-plat"></span>
        <span class="fl-upd" id="fl-upd" aria-live="polite">불러오는 중…</span>
      </div>
      <nav class="fl-map" id="fl-map" aria-label="흐름 지도"></nav>
      <div id="fl-lanes" style="min-width:0;scroll-margin-top:72px"></div>
      <div class="fl-low">
        <section class="card fl-feed"><div class="card-h"><h2>오늘 움직인 주문</h2></div><ul id="fl-feed"></ul></section>
        <section class="card fl-next"><div class="card-h"><h2>지금 하는 일과 다음 회차</h2></div><ul id="fl-next"></ul></section>
      </div>`;
    $('fl-q').before(ic('search'));
    const dr = E('aside', 'fl-dr'); dr.id = 'fl-dr'; dr.hidden = true; if (window.barunDrawer) window.barunDrawer(dr, { label: '자세히' }); else { dr.setAttribute('role', 'dialog'); dr.setAttribute('aria-label', '자세히'); }   // 공용 서랍(index.html): aria-modal·Tab 가두기·초점 돌려주기
    const scrim = E('div', 'fl-scrim'); scrim.id = 'fl-scrim'; scrim.hidden = true; scrim.onclick = () => closeDr();
    document.body.append(scrim, dr);
    $('fl-q').addEventListener('input', (e) => { flt.q = e.target.value.trim().toLowerCase(); render(); });
    chips('fl-only', ONLY, 'only', 'fl-chip');
    chips('fl-plat', platOpts(), 'plat', '');
    document.addEventListener('barun:accounts', () => { if (!platOpts().some(([v]) => v === flt.plat)) flt.plat = ''; chips('fl-plat', platOpts(), 'plat', ''); if (data) render(); });
    // 2026-11-06: 서랍에서 연 '맡기기' 창(dialog)에서 Esc를 누르면 서랍까지 같이 닫혔음 → 위에 창이 열려 있으면 그것만
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('fl-dr').hidden && !document.querySelector('dialog[open]')) closeDr(); });
    document.addEventListener('barun:page', (e) => { shown = e.detail === 'flow'; if (shown) { load(); start(); } else { stop(); closeDr(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (shown) { load(); start(); } });
    NARROW.addEventListener('change', () => { if (data) render(); });
    if (!sec.hidden) { shown = true; load(); start(); }
    return true;
  }
  function chips(id, opts, key, cls) {
    const box = $(id); box.textContent = '';
    for (const [v, t] of opts) {
      const b = E('button', cls || null, t); b.type = 'button'; b.setAttribute('aria-pressed', String(flt[key] === v));
      b.onclick = () => { flt[key] = v; chips(id, opts, key, cls); render(); }; box.append(b);
    }
  }
  // 옆으로 넘치는 곳: 넘치는 쪽에 표시(host에 fade-l·fade-r), 넘김 버튼(nav)은 끝에서 잠금·넘칠 게 없으면 숨김
  const edges = (el, host, nav) => {
    if (!el) return; host = host || el;
    el._edge = () => {
      const l = el.scrollLeft > 2, r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      host.classList.toggle('fade-l', l); host.classList.toggle('fade-r', r);
      if (nav) { nav.hidden = !l && !r; nav.children[0].disabled = !l; nav.children[1].disabled = !r; }
    };
    if (!el._edgeOn) { el._edgeOn = true; el.addEventListener('scroll', () => el._edge(), { passive: true }); }
    requestAnimationFrame(el._edge);
  };
  const vfade = (el) => { const f = () => el.classList.toggle('fade-b', el.scrollTop + el.clientHeight < el.scrollHeight - 2); el.addEventListener('scroll', f, { passive: true }); requestAnimationFrame(f); };
  window.addEventListener('resize', () => document.querySelectorAll('.fl-cols, .fl-map, .fl-tabs').forEach((x) => x._edge && x._edge()));
  function start() { stop(); timer = setInterval(load, 20000); }
  function stop() { clearInterval(timer); timer = 0; }

  async function load(fresh) {          // fresh = 버튼 뒤(서버 10초 모아 두기를 건너뜀) — 늦게 온 옛 답이 새 답을 덮지 않게 순번
    if (busy && !fresh) return; busy = true;
    const my = ++seqN;
    const upd = $('fl-upd');
    try {
      const r = await (window.barunFetch || fetch)('/api/flow' + (fresh ? '?fresh=1' : ''));
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);
      const j = await r.json(); if (my < applied) return; applied = my; data = j;
      const sa = T(j.at); if (sa) skew = Math.round((Date.now() - sa) / 9e5) * 9e5;
      render(); upd.textContent = `${stamp(data.at)} 갱신`; upd.classList.remove('err'); upd.title = '';
    } catch (e) {   // 2026-11-06: 503이면 빈 화면에 아무 말이 없던 것 → 갱신 자리에 실패, 처음이면 칸반 자리에도(원문은 마우스를 올리면)
      if (e.message === '로그인 필요' || my < applied) return;
      upd.textContent = data ? `새로 읽지 못했어요 · ${stamp(data.at)} 자료` : '읽지 못했어요'; upd.classList.add('err'); upd.title = `원문: ${e.message}`;
      if (!data) { const b = $('fl-lanes'); b.textContent = ''; const m = E('div', 'fl-empty', '업무 흐름을 읽지 못했어요. 20초 뒤에 다시 읽어요.'); m.title = `원문: ${e.message}`; b.append(m); }
    } finally { busy = false; }
  }
  // 버튼 — 할 일·주문 데이터 화면과 같은 길. out(결과 줄)이 있으면 거기에, 시트가 회차 중이면 '그래도 하기'
  async function act(body, btn, out) {
    if (body.action === 'reject' && !confirm('거절할까요?')) return null;
    const lab = btn ? [...btn.childNodes] : [];   // 그림 버튼이 끝난 뒤 그림을 잃지 않게(2026-11-12)
    if (btn) { btn.disabled = true; if (body.kind === 'sheet_edit') btn.textContent = '시트에 쓰는 중…'; }
    try {
      const r = await (window.barunFetch || fetch)('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({ ok: false, msg: `서버 답을 읽지 못했어요(${r.status}). 잠시 뒤 다시 눌러 주세요.` }));
      const msg = noE(String(j.msg || ''));
      if (window.toast) window.toast((j.ok ? '' : '실패: ') + msg.split('\n')[0].slice(0, 120));
      if (out) {
        out.textContent = ''; out.hidden = false; out.className = 'fl-out ' + (j.ok ? 'ok' : 'bad');
        out.append(ic(j.ok ? 'check' : 'alert'), E('span', null, msg));
        if (!j.ok && /회차가 시트를 쓰는 중/.test(msg)) { const b = E('button', 'btn sm weak', '그래도 하기'); b.type = 'button'; b.onclick = () => act(Object.assign({}, body, { force: true }), b, out); out.append(b); }
      }
      if (j.ok) await load(true);
      return j;
    } catch (e) { if (window.toast) window.toast('실패: ' + e.message); return null; } finally { if (btn) { btn.disabled = false; btn.replaceChildren(...lab); } }
  }

  // ── 거르기 ──
  const pass = (o) => {
    if (flt.plat && flt.plat[0] === '@') { if (o.k !== 'o' || o.plat !== '쿠팡' || (o.acct || '') !== flt.plat.slice(1)) return false; }   // 쿠팡 판매 계정
    else if (flt.plat && o.plat && o.plat !== flt.plat) return false;
    if (flt.plat && !o.plat && o.k === 'o') return false;
    if (flt.only === 'late' && o.due_k !== 'late') return false;
    if (flt.only === 'human' && !(o.human || []).length) return false;
    if (flt.only === 'stuck' && !o.stuck) return false;
    if (flt.q) {
      const hay = [o.who, o.name, o.opt, o.id, o.tab, o.sub, o.acct_label, o.tab && o.row ? `${o.tab} ${o.row}행` : ''].join(' ').toLowerCase();
      if (!flt.q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  };
  const filtering = () => !!(flt.q || flt.only || flt.plat);

  function render() {
    if (!data) return;
    const st = Object.fromEntries(data.stages.map((s) => [s.id, s]));
    const objs = data.objs.filter(pass);
    const by = {}; for (const o of objs) (by[o.stage] = by[o.stage] || []).push(o);
    const cards = Object.fromEntries(data.cards.map((c) => [c.id, c]));
    kpis(st);
    map(st, by);
    lanes(st, by, cards);
    low();
    const ps = {}; for (const o of data.objs) ps[o.id] = o.stage; prevStage = ps;
  }

  function kpis(st) {
    const box = $('fl-kpis'); box.textContent = '';
    const t = data.totals, ord = data.objs.filter((o) => o.k === 'o');
    const flowing = ord.filter((o) => o.stage !== 'done').length, transit = ord.filter((o) => o.stage === 'transit').length;
    const work = Object.values(data.agents).filter((a) => a.state === 'running').map((a) => role(a.name)).concat(data.tasks.filter((x) => x.state === 'running').map((x) => noE(x.title)));
    const base = T(data.at) || nowD(), yd = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 1);
    const ydk = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`;
    const yday = (st.new.extra.sales || []).find((x) => x.day === ydk) || { n: 0 };   // 어제 = 날짜로(주문 없는 날은 목록에 없어 끝에서 두 번째가 그저께일 수 있음)
    // 2026-11-06: 주문 경로 화면(진행 중 26 · 판단할 일 79)과 숫자가 달라 헷갈려서 — 무엇을 세는지 이름·설명에(여기는 카드 수, 국내 배송 중 포함 시트 줄)
    const K = [
      { k: '지금 일하는 중', v: `${work.length}`, d: work.length ? work.join(' · ') : '모두 쉬는 중', cls: work.length ? 'run' : '', go: () => $('fl-next').scrollIntoView({ behavior: 'smooth', block: 'center' }) },
      { k: '사람 차례 카드', v: `${t.human}`, d: `할 일·승인 카드${t.snoozed ? ` · 미룬 것 ${t.snoozed}` : ''}`, cls: t.human ? 'bad' : '', only: 'human' },
      { k: '진행 중 주문', v: `${flowing}`, d: `배송 중 ${transit} 포함 · 기한 지남 ${t.late}`, cls: t.late ? 'warn' : '', only: 'late' },
      { k: '오래 머묾', v: `${t.stuck}`, d: `주문 ${ord.filter((o) => o.stuck).length} · 상품 ${data.objs.filter((o) => o.stuck && o.k === 'p').length}`, cls: t.stuck ? 'warn' : '', only: 'stuck' },
      { k: '오늘 주문', v: `${t.today.n}건`, d: `${won(t.today.paid)} · 어제 ${yday.n}건`, cls: '', go: () => go('new') },
      { k: '준비 중 상품', v: `${t.products}`, d: '소싱·등록·심사', cls: '', go: () => go('listing') },
    ];
    for (const x of K) {
      const b = E('button', 'stat ' + x.cls); b.type = 'button';
      if (x.only) {
        b.setAttribute('aria-pressed', String(flt.only === x.only));
        b.onclick = () => { flt.only = flt.only === x.only ? '' : x.only; chips('fl-only', ONLY, 'only', 'fl-chip'); render(); };
      } else b.onclick = x.go;
      b.append(E('div', 'k', x.k), E('div', 'v', x.v), E('div', 'd', x.d)); b.title = x.only ? `${x.d} · 누르면 이것만 봐요` : x.d; box.append(b);
    }
  }

  const cnt = (s, by) => { const n = (by[s.id] || []).length; return filtering() ? n : Math.max(n, s.count || 0); };   // 원가 확인은 목록 40개·숫자 전부
  const running = (s) => s.jobs.some((j) => (data.agents[j] || {}).state === 'running') || data.tasks.some((x) => x.state === 'running' && x.stage === s.id);
  function map(st, by) {
    const box = $('fl-map'); box.textContent = '';
    const main = data.stages.filter((s) => s.n);
    const lanes = E('div', 'fl-map-lanes');
    for (const ln of data.lanes.filter((l) => l.id !== 'care')) {
      const n = main.filter((s) => s.lane === ln.id).length, sp = E('span', null, ln.name);
      sp.style.flex = `${n} ${n} 0`; lanes.append(sp);
    }
    const row = E('div', 'fl-map-row');
    main.forEach((s, i) => {
      if (i) {
        const lk = E('div', 'fl-link' + (s.lane !== main[i - 1].lane ? ' gap' : ''));
        if (s.into) { const b = E('b', null, `+${s.into}`); b.title = `${s.name}에 오늘 ${s.into}건 들어옴`; lk.append(E('i'), b); }
        row.append(lk);
      }
      row.append(node(s, by));
    });
    box.append(lanes, row);
    const foot = E('div', 'fl-map-foot'), side = E('div', 'fl-map-side');
    side.append(E('span', null, (data.lanes.find((l) => l.id === 'care') || {}).name || '그 밖'));
    for (const s of data.stages.filter((x) => !x.n)) {
      const b = E('button', 'fl-sn' + (s.late ? ' hot' : running(s) ? ' run' : '')); b.type = 'button';
      b.append(E('span', null, s.name), E('b', null, String(cnt(s, by))));
      if (s.human) b.append(hum('span', 'h', s.human));
      b.title = `${s.name} · ${s.what}`; b.onclick = () => go(s.id); side.append(b);
    }
    const lg = E('div', 'fl-mlg'), item = (...xs) => { const sp = E('span'); sp.append(...xs); lg.append(sp); };
    item(E('i', 'ring'), document.createTextNode('기한 지난 것 있음'));
    item(E('i', 'ring run'), document.createTextNode('일하는 중'));
    item(E('b', null, '+n'), document.createTextNode('오늘 들어옴'));
    item(ic('hand'), document.createTextNode('사람 차례'));
    foot.append(side, lg);
    box.append(foot);
    edges(box);
  }
  function node(s, by) {
    const n = cnt(s, by), run = running(s);
    const b = E('button', 'fl-node' + (n ? ' has' : '') + (s.late ? ' hot' : '') + (run ? ' run' : '')); b.type = 'button';
    b.title = `${s.n}. ${s.name} · ${s.what}${run ? ' · 일하는 중' : ''}${s.into ? ` · 오늘 ${s.into}건 들어옴` : ''}`;
    const c = E('span', 'c', String(n)); const nm = E('span', 'nm', s.name), num = E('span', 'n', `${s.n}단계`);
    const bd = E('span', 'b');
    if (s.human) bd.append(hum('i', 'h', s.human));
    if (s.into) { const g = E('i', 'in', `+${s.into}`); g.title = `오늘 ${s.into}건 들어옴`; bd.append(g); }
    if (s.late) { const l = E('i', 'l', `늦음 ${s.late}`); l.title = `기한 지난 것 ${s.late}건`; bd.append(l); }
    else if (s.stuck) { const l = E('i', null, `머묾 ${s.stuck}`); l.title = `${s.sla}일 넘게 머문 것 ${s.stuck}건`; bd.append(l); }
    b.append(c, nm, num, bd); b.onclick = () => go(s.id);
    b.setAttribute('aria-label', `${s.n}단계 ${s.name} ${n}건${s.human ? `, 사람 차례 ${s.human}` : ''}${s.late ? `, 기한 지남 ${s.late}` : ''}${run ? ', 일하는 중' : ''}`);
    return b;
  }
  function go(sid) {
    const s = data && data.stages.find((x) => x.id === sid); if (!s) return;
    if (s.lane !== lane) setLane(s.lane);
    opened[sid] = true; render();
    const col = document.querySelector(`.fl-col[data-sid="${sid}"]`); if (!col) return;
    $('fl-lanes').scrollIntoView({ behavior: 'smooth', block: 'start' });
    col.parentElement.scrollTo({ left: Math.max(0, col.offsetLeft - 16), behavior: 'smooth' });
    col.classList.remove('flash'); void col.offsetWidth; col.classList.add('flash');
  }

  function lanes(st, by, cards) {
    const box = $('fl-lanes');
    if (!data.lanes.some((l) => l.id === lane)) setLane('order');
    const old = box.querySelector('.fl-cols'), keepL = old && old.dataset.lane === lane ? old.scrollLeft : 0;
    const keepT = {}; box.querySelectorAll('.fl-body').forEach((l) => { keepT[l.dataset.sid] = l.scrollTop; });
    box.textContent = '';
    const wrap = E('section', 'fl-board'); wrap.setAttribute('aria-label', '단계별 칸');
    const bh = E('div', 'fl-bh'), tabs = E('div', 'fl-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '흐름');
    for (const ln of data.lanes) {
      const ss = data.stages.filter((s) => s.lane === ln.id);
      // 2026-11-12: '주문 N'이 배송 완료(최근 3일, 끝난 주문) 칸까지 세던 것 → 끝난 칸은 칸에만 보이고 숫자는 진행 중만(위 '진행 중 주문'과 같은 셈)
      const fin = ss.filter((s) => s.id === 'done').reduce((a, s) => a + cnt(s, by), 0);
      const tot = ss.filter((s) => s.id !== 'done').reduce((a, s) => a + cnt(s, by), 0), nh = ss.reduce((a, s) => a + s.human, 0);
      const b = E('button', 'fl-tab'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(ln.id === lane));
      b.append(document.createTextNode(ln.name), E('b', null, String(tot)));
      if (nh) { const h = E('span', 'h'); h.append(ic('hand'), E('span', 'lab', '사람 '), document.createTextNode(String(nh))); h.title = `사람 차례 카드 ${nh}장`; b.append(h); }
      b.title = ln.desc + (fin ? ` · 숫자는 진행 중인 것만 세요(배송 완료 ${fin}건 뺌)` : ''); b.onclick = () => { setLane(ln.id); render(); }; tabs.append(b);
    }
    const cur = data.lanes.find((l) => l.id === lane);
    const nav = E('span', 'fl-nav'); nav.hidden = true;
    const cols = E('div', 'fl-cols'); cols.dataset.lane = lane; cols.setAttribute('role', 'tabpanel');
    for (const [name, lab, dir] of [['back', '앞 칸 보기', -1], ['arrow', '다음 칸 보기', 1]]) {
      const b = E('button'); b.type = 'button'; b.append(ic(name)); b.setAttribute('aria-label', lab); b.title = lab;
      b.onclick = () => cols.scrollBy({ left: dir * Math.max(284, cols.clientWidth * 0.8), behavior: 'smooth' }); nav.append(b);
    }
    bh.append(tabs, E('span', 'd', cur.desc), nav);
    for (const s of data.stages.filter((x) => x.lane === lane)) cols.append(column(s, by[s.id] || [], cards));
    const cw = E('div', 'fl-cw'); cw.append(cols);
    wrap.append(bh, cw); box.append(wrap);
    cols.scrollLeft = keepL; edges(cols, cw, nav); edges(tabs);
    box.querySelectorAll('.fl-body').forEach((l) => { if (keepT[l.dataset.sid]) l.scrollTop = keepT[l.dataset.sid]; vfade(l); });
  }

  const PAL = ['var(--st-run)', 'var(--st-warn)', 'var(--st-serious)', 'var(--st-good)', 'var(--muted)', 'var(--st-crit)'];
  function column(s, list, cards) {
    const cs = s.cards.map((id) => cards[id]).filter(Boolean);
    const ags = s.jobs.map((j) => data.agents[j]).filter(Boolean).sort((x, y) => (y.state === 'running') - (x.state === 'running'));
    const tks = data.tasks.filter((x) => x.stage === s.id);
    const isRun = running(s), no = s.n ? String(s.n) : '·';
    if (!list.length && !cs.length && !opened[s.id]) {        // 빈 단계 — 위에 붙은 작은 칸으로 접어 둠(눌러서 펼침)
      const c = E('button', 'fl-col shut' + (isRun ? ' run' : '')); c.type = 'button'; c.dataset.sid = s.id;
      const z = E('span', 'z', filtering() ? '맞는 것 0건' : '0건');
      if (isRun) z.append(document.createTextNode(' · '), E('span', 'dot run'), document.createTextNode('일하는 중'));
      c.append(E('span', 'no', no), E('span', 'vn', s.name), z);
      c.title = `${s.n ? `${s.n}. ` : ''}${s.name} · ${emptyText(s)} · 누르면 펼쳐요`;
      c.setAttribute('aria-label', `${s.name} 0건${isRun ? ', 일하는 중' : ''}, 펼치기`); c.onclick = () => { opened[s.id] = true; render(); };
      return c;
    }
    const col = E('section', 'fl-col' + (s.late ? ' late' : s.stuck ? ' stuck' : isRun ? ' run' : '')); col.dataset.sid = s.id;
    col.setAttribute('aria-label', `${s.n ? `${s.n}단계 ` : ''}${s.name} ${list.length}건`);
    const h = E('header', 'fl-ch'), t = E('div', 't');
    t.append(E('span', 'no', no), E('h3', null, s.name));
    if (s.level != null) { const lv = E('span', 'fl-lv'); const i = E('i'); i.style.background = LVC[s.level]; lv.append(i, document.createTextNode(LV[s.level])); lv.title = `자동화 수준 ${LV[s.level]}`; t.append(lv); }
    t.append(E('span', 'fl-ct', filtering() && list.length !== s.count ? `${list.length}/${s.count}` : String(Math.max(list.length, s.count || 0))));
    h.title = s.what; h.append(t);
    const fl = E('div', 'fl-flags');
    if (cs.length) fl.append(hum('span', 'fl-tag h', cs.length, '사람 차례 '));
    if (s.late) fl.append(E('span', 'fl-tag l', `기한 지남 ${s.late}`));
    if (s.stuck) fl.append(E('span', 'fl-tag s', `${s.sla}일 넘게 머묾 ${s.stuck}`));
    if (s.into) fl.append(E('span', 'fl-tag g', `오늘 +${s.into}`));
    if (fl.children.length) h.append(fl);
    if (s.groups.length > 1) {                          // 칸 안 나눔(배대지별·상태별) — 하나뿐이면 생략
      const tot = s.groups.reduce((a, g) => a + g[1], 0), bar = E('div', 'fl-bar'), lg = E('div', 'fl-legend');
      s.groups.slice(0, 6).forEach(([g, n], i) => {
        const b = E('b'); b.style.width = `${n / tot * 100}%`; b.style.background = PAL[i % PAL.length]; b.title = `${ko(g)} ${n}`; bar.append(b);
        if (i < 4) { const sp = E('span'); const d = E('i'); d.style.background = PAL[i % PAL.length]; sp.append(d, document.createTextNode(`${ko(g)} ${n}`)); lg.append(sp); }
      });
      h.append(bar, lg);
    }
    if (ags.length || tks.length) {                     // 담당 — 한 줄씩(자세한 건 칸 안 '담당')
      const w = E('div', 'fl-who');
      for (const a of ags.slice(0, 2)) w.append(agentLine(a));
      for (const x of tks.slice(0, 1)) {
        const r = x.state === 'running', l = E('div', 'fl-ac' + (r ? ' run' : ''));
        if (r) l.append(E('span', 'dot run'));
        l.append(E('span', 'nm', noE(x.title) || '맡긴 일'), E('span', 'w', r ? '일하는 중' : '차례 기다림')); w.append(l);
      }
      h.append(w);
    }
    col.append(h);
    const body = E('div', 'fl-body'); body.dataset.sid = s.id;
    const info = extra(s); if (info) body.append(info);
    if (ags.length + tks.length) {
      const d = E('details'); d.open = isRun;
      d.append(E('summary', null, `담당 ${ags.length + tks.length}`));
      for (const a of ags) d.append(agent(a, s));
      for (const x of tks) d.append(task(x));
      body.append(d);
    }
    if (cs.length) {
      body.append(hum('div', 'fl-sec', cs.length, '사람 차례 '));
      for (const c of cs.slice(0, more['c' + s.id] ? 99 : 3)) body.append(hcard(c));
      if (cs.length > 3 && !more['c' + s.id]) { const m = E('button', 'fl-more', `카드 ${cs.length - 3}장 더 보기`); m.type = 'button'; m.onclick = () => { more['c' + s.id] = true; render(); }; body.append(m); }
    }
    if (list.length) body.append(E('div', 'fl-sec', `${s.lane === 'product' ? '상품' : s.id === 'asks' ? '문의' : '주문'} ${list.length}`));
    const lim = more[s.id] ? 400 : LIMIT();
    for (const o of list.slice(0, lim)) body.append(obj(o));
    if (!list.length) body.append(E('div', 'fl-empty', filtering() ? '조건에 맞는 것이 없어요' : emptyText(s)));
    if (list.length > lim) { const m = E('button', 'fl-more', `${list.length - lim}건 더 보기`); m.type = 'button'; m.onclick = () => { more[s.id] = true; render(); }; body.append(m); }
    else if (more[s.id] && list.length > LIMIT()) { const m = E('button', 'fl-more', '접기'); m.type = 'button'; m.onclick = () => { more[s.id] = false; render(); }; body.append(m); }
    col.append(body);
    return col;
  }
  function agentLine(a) {
    const [lab, cls] = AST[a.state] || AST.idle;
    const fail = a.state !== 'running' && a.last_state === 'failed';
    const l = E('div', 'fl-ac' + (a.state === 'running' ? ' run' : fail ? ' fail' : ''));
    const w = a.state === 'running' ? (a.secs ? `일하는 중 · ${secs(a.secs)}` : '일하는 중') : fail ? '최근 실패' : a.next ? `다음 ${when(a.next)}` : a.on ? '신호 오면 바로' : cls ? lab : '';
    const mk = a.state === 'running' ? 'run' : fail ? 'bad' : a.state === 'watching' ? 'ok' : '';   // 쉬는 담당은 점 없이(이름 앞 ①·② 번호와 표시가 겹치던 것)
    if (mk) l.append(E('span', 'dot ' + mk));
    l.append(E('span', 'nm', role(a.name)), E('span', 'w', w));
    l.title = `${role(a.name)} · ${noE(a.doing) || lab}`;
    return l;
  }
  function emptyText(s) {
    return { new: '들어온 주문은 바로 다음 단계로 넘어가요', inquiry: '고객 문의는 사람 차례 카드로 와요', close: '매일 22시에 마감해요' }[s.id] || '지금 이 단계에 있는 건이 없어요';
  }
  function extra(s) {
    const x = s.extra || {}, d = E('div', 'fl-info');
    const add = (t, v) => { d.append(document.createTextNode(t)); if (v != null) d.append(E('b', null, String(v))); };
    if (s.id === 'new' && x.today) { add('오늘 주문 ', `${x.today.n}건`); add(` · ${won(x.today.paid)}`); const y = (x.sales || []).slice(-7); if (y.length) { d.append(E('br')); add('최근 7일 ', `${y.reduce((a, v) => a + v.n, 0)}건`); add(` · ${won(y.reduce((a, v) => a + v.paid, 0))}`); } return d; }
    if (s.id === 'cost' && (x.units ?? x.products) != null) {
      add('원가를 모르는 판매 단위 ', `${x.units ?? x.products}${x.pids != null ? `(상품 ${x.pids})` : ''}`); add(` · 옵션 ${x.options}개 · 쿠팡 ${x.coupang} · 네이버 ${x.naver}`);
      if (x.shown && (x.units ?? x.products) > x.shown) add(` · 아래는 주문 많은 순 ${x.shown}개`);
      return d;
    }
    if (s.id === 'prep' && x.approval) { const ap = x.approval; add('등록 승인 카드 '); d.append(E('b', null, { pending: '답 기다림', approved: '승인됨', none: '없음' }[ap.status] || ap.status)); if (ap.n) add(` · ${ap.n}줄`); return d; }
    if (s.id === 'source' && x.today) { add('오늘 새로 닫은 줄 ', `${x.today.closed ?? x.today.n ?? 0}/${x.today.target || 10}`); const r = x.run || {}; if (r.next) add(` · 다음 ⑨ 소싱 회차 ${when(r.next)}`); return d; }
    if (s.id === 'selling' && x.onsale) { add(x.onsale.by ? `판매 중 ${x.onsale.by} ` : '판매 중 '); d.append(E('b', null, `쿠팡 ${x.onsale['쿠팡']} · 네이버 ${x.onsale['네이버']}`)); add(' · 아래는 예외만'); return d; }
    if (s.id === 'listing' && (x.regs || []).length) { const r = x.regs[0]; add('마지막 등록 '); d.append(E('b', null, when(r.at))); add(` · ${r.platform === 'coupang' ? '쿠팡' : '네이버'} ${r.ok ? '성공' : '실패'}`); return d; }
    if (s.id === 'asks' && x.waiting != null) { add('보낸 문의 '); d.append(E('b', null, `답 옴 ${x.answered} · 기다림 ${x.waiting}`)); add(` · 2일 넘음 ${x.overdue}`); d.append(E('br')); add('아래는 기다리는 문의와 할 일이 남은 답이에요'); return d; }
    if (s.id === 'center' && x.stock && Object.keys(x.stock).length) { add('보관 재고 '); d.append(E('b', null, Object.entries(x.stock).map(([k, v]) => `${k.replace('재고·', '')} ${v}`).join(' · '))); return d; }
    return null;
  }
  function agent(a, s) {
    const box = E('div', 'fl-ag');
    const t = E('div', 't'); const [lab, cls] = AST[a.state] || AST.idle;
    t.append(E('span', 'nm', role(a.name)), E('span', 'fl-st ' + cls, lab)); t.title = role(a.name); box.append(t);
    if (a.state === 'running') {
      box.append(E('div', 'd', noE(a.doing) || '일하는 중'));
      if ((a.subs || []).length) box.append(E('div', 'x', `함께 하는 일 ${a.subs.length} · ${a.subs.map(noE).join(' · ')}`));
      if (a.secs) box.append(E('div', 'x', secs(a.secs)));
    } else if (a.kind === 'hub' && a.hub) {
      const src = a.hub[s.hub];
      box.append(E('div', 'd', src ? `${src.label} ${when(src.last_ok)} 확인${src.fails ? ` · 연속 실패 ${src.fails}` : ''}` : '몇 분마다 확인해요'));
    } else if (a.last_at) {
      const d = E('div', 'd' + (a.last_state === 'failed' ? ' fail' : ''), `${when(a.last_at)} ${a.last_state === 'failed' ? '실패' : a.last_state === 'skipped' ? '건너뜀' : '완료'}${a.last_note ? ` · ${ko(a.last_note)}` : ''}`);
      d.title = noE(a.last_note); box.append(d);
    }
    const nx = [];
    if (a.waiting) nx.push(`대기열 ${a.waiting}`);
    if (a.next) nx.push(`다음 ${when(a.next)}`);
    if (a.on && !a.next) nx.push('신호 오면 바로');
    if (nx.length && a.state !== 'running') box.append(E('div', 'x', nx.join(' · ')));
    return box;
  }
  function task(t) {
    const ok = /^https?:\/\//i.test(t.url || '');   // 2026-11-06: 주소 없는 일은 href='#'이라 누르면 주소가 바뀌고 맨 위로 튀었음 → 링크 아님
    const box = E(ok ? 'a' : 'div', 'fl-ag'); if (ok) { box.href = t.url; box.target = '_blank'; box.rel = 'noopener'; } box.style.textDecoration = 'none'; box.style.color = 'inherit'; box.style.display = 'block';
    const r = t.state === 'running', h = E('div', 't'); h.append(E('span', 'nm', noE(t.title) || '맡긴 일'), E('span', 'fl-st ' + (r ? 'run' : 'wait'), r ? '일하는 중' : '차례 기다림'));
    box.append(h); if (t.doing) box.append(E('div', 'd', noE(t.doing))); if (t.secs) box.append(E('div', 'x', `맡긴 일 · ${secs(t.secs)}`));
    return box;
  }
  function hcard(c) {
    const b = E('button', 'fl-hc'); b.type = 'button'; b.dataset.card = c.id;
    b.append(E('div', null, noE(c.title)));
    const m = E('div', 'm'); m.append(E('b', null, CST[c.state] || c.state));
    const one = c.approval ? '승인 필요' : (c.choices || []).length ? '선택 필요' : '';
    if (one) m.append(document.createTextNode(' · '), E('span', 'ap', one));
    m.append(document.createTextNode(` · ${when(c.at)}${(c.objs || []).length ? ` · 주문 ${c.objs.length}건` : ''}${c.moved ? ' · 칸 옮김' : ''}`)); b.append(m);
    b.title = '누르면 자세히 보고 바로 답할 수 있어요';
    b.onclick = () => openCard(c, b);
    return b;
  }
  function obj(o) {
    const lateCls = o.due_k === 'late' ? 'late' : o.due_k === 'today' ? 'today' : o.stuck ? 'stuck' : '';
    const moved = prevStage[o.id] && prevStage[o.id] !== o.stage;
    const b = E('button', 'fl-ob ' + lateCls + (moved ? ' moved' : '')); b.type = 'button'; b.dataset.id = o.id;
    const r1 = E('div', 'r1');
    if (o.plat) r1.append(E('span', 'pl ' + (o.plat === '쿠팡' ? 'c' : 'n'), o.plat));
    if (o.acct && window.acctTag) r1.append(window.acctTag(o.acct, o.acct_label));   // 다른 쿠팡 판매 계정 주문
    const title = o.k === 'o' ? (o.who || '받는 분 없음') : o.k === 'a' ? (o.who || '문의') : (ko(o.sub) || '상품');
    r1.append(E('span', 'who', title));
    if (o.due_t && o.due_k !== 'ok') r1.append(E('span', 'du ' + o.due_k, `기한 ${o.due_t}`));
    else if (o.days != null && o.k !== 'o') r1.append(E('span', 'du', stay(o.days)));
    else if (o.changed && !['listing', 'selling'].includes(o.stage)) r1.append(E('span', 'du', `${when(o.changed)} 바뀜`));   // 판매 목록 바뀐 때 = 따라 쓰기 시각이라 뺌
    b.append(r1);
    b.append(E('div', 'nm', `${o.name}${o.opt ? ` · ${o.opt}` : ''}${o.qty > 1 ? ` ×${o.qty}` : ''}`));
    const r3 = E('div', 'r3');
    const bits = [];
    if (o.k === 'o') { if (o.tab) bits.push(`${o.tab} ${o.row}행`); if (o.sub && !['', '해외구매'].includes(o.sub)) bits.push(ko(o.sub)); if (o.days != null) bits.push(stay(o.days)); }
    else if (o.k === 'p') {
      if (o.sub && !['listing', 'selling'].includes(o.stage) && !(o.stage === 'source' && o.wait)) bits.push(ko(o.sub));
      if (o.days != null && o.stage === 'source') bits.push(stay(o.days));
      if (o.opts > 1) bits.push(`옵션 ${o.opts}개`);
      if (o.profit) bits.push(`이익 ${won(o.profit)}`); if (o.price) bits.push(won(o.price) + (o.opts > 1 ? '부터' : ''));
      if (o.days == null && ['listing', 'selling'].includes(o.stage)) bits.push('들어온 날 모름');
    }
    else bits.push(stay(o.days));
    r3.append(E('span', 'sub', bits.filter(Boolean).join(' · ')));
    for (const t of o.tags || []) r3.append(E('span', 'fl-tag' + (t === '문제' ? ' l' : t === '답 옴' ? ' h' : ''), t));
    if (o.nx) { const n = E('span', 'nx', o.nx); n.title = '다음 할 일 · 누르면 자세히'; r3.append(n); }
    if ((o.human || []).length) { const h = ic('hand', 'h'); h.title = '사람 차례 카드가 있어요'; r3.append(h); }
    else if ((o.zz || []).length) { const h = ic('sleep', 'h'); h.title = '미뤄 둔 카드가 있어요'; r3.append(h); }
    b.append(r3);
    b.setAttribute('aria-label', `${title} ${o.name} ${bits.join(' ')}${o.due_k === 'late' ? ' 발송기한 지남' : ''}${o.nx ? ` 다음 할 일 ${o.nx}` : ''}`);
    b.onclick = () => openDr(o, b);
    return b;
  }

  // ── 아래: 오늘 움직인 주문 · 지금 하는 일과 다음 회차 ──
  function low() {
    const st = Object.fromEntries(data.stages.map((s) => [s.id, s]));
    const f = $('fl-feed'); f.textContent = '';
    if (!data.feed.length) f.append(E('li', 'none', '오늘은 아직 움직인 주문이 없어요.'));
    for (const x of data.feed.slice(0, 18)) {
      const li = E('li'); li.append(E('span', 'tm', when(x.at)));
      const b = E('button'); b.type = 'button';
      b.append(document.createTextNode(`${x.who || x.id.slice(-8)} `), E('span', 'to', `→ ${(st[x.to] || {}).name || x.to}`), document.createTextNode(` · ${ko(x.what)}`));
      b.onclick = () => { const o = data.objs.find((y) => y.id === x.id); if (o) openDr(o, b); };
      li.append(b); f.append(li);
    }
    const nx = $('fl-next'); nx.textContent = '';
    const stOf = {}; for (const s of data.stages) for (const j of s.jobs) (stOf[j] = stOf[j] || []).push(s.name);
    const ag = Object.values(data.agents);
    const now = ag.filter((a) => a.state === 'running'), tk = data.tasks.filter((t) => t.state === 'running');
    const line = (on, txt) => { const sp = E('span'); if (on) sp.append(E('span', 'dot run')); sp.append(document.createTextNode(txt)); return sp; };
    for (const a of now) { const li = E('li'); li.append(E('span', 'tm', '지금'), line(true, `${role(a.name)} · ${noE(a.doing) || '일하는 중'}${(stOf[a.id] || []).length ? ` · ${stOf[a.id].join('·')}` : ''}`)); nx.append(li); }
    for (const t of tk) { const li = E('li'); li.append(E('span', 'tm', '지금'), line(true, `${noE(t.title)} · ${noE(t.doing) || '일하는 중'}`)); nx.append(li); }
    const up = ag.filter((a) => a.next && a.state !== 'running').sort((a, b) => a.next.localeCompare(b.next)).slice(0, 10);
    for (const a of up) { const li = E('li'); li.append(E('span', 'tm', when(a.next)), line(false, `${role(a.name)}${(stOf[a.id] || []).length ? ` → ${stOf[a.id].join('·')}` : ''}`)); nx.append(li); }
    if (!nx.children.length) nx.append(E('li', 'none', '지금 도는 일도, 예정된 회차도 없어요.'));
  }

  // ── 객체 자세히(서랍) ──
  function closeDr() {
    const d = $('fl-dr'); if (!d || d.hidden) return;
    d.hidden = true; $('fl-scrim').hidden = true; openObj = null;
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    else if (lastFocus) {                                // 다시 그려진 같은 카드·객체로
      const again = lastFocus.dataset.card ? document.querySelector(`.fl-hc[data-card="${CSS.escape(lastFocus.dataset.card)}"]`)
        : document.querySelector(`.fl-ob[data-id="${CSS.escape(lastFocus.dataset.id || '')}"]`);
      if (again) again.focus({ preventScroll: true });
    }
  }
  async function openDr(o, from) {
    lastFocus = from || document.activeElement; openObj = o;
    const d = $('fl-dr'); d.hidden = false; $('fl-scrim').hidden = false; d.textContent = '';
    const st = Object.fromEntries(data.stages.map((s) => [s.id, s]));
    const head = E('div', 'fl-dr-h'); const h = E('h2', null, o.k === 'o' ? (o.who || '주문') : o.k === 'a' ? (o.who || '문의') : (o.name || '상품')); h.tabIndex = -1;
    h.append(E('div', 'sub', o.k === 'o' ? `${o.name}${o.opt ? ` · ${o.opt}` : ''}${o.qty > 1 ? ` ×${o.qty}` : ''}` : o.k === 'a' ? o.name : `${o.plat || ''} ${ko(o.sub)}`.trim()));
    const x = E('button', 'fl-x'); x.append(ic('x')); x.type = 'button'; x.setAttribute('aria-label', '닫기'); x.onclick = closeDr;
    head.append(h, x);
    const body = E('div', 'fl-dr-b');
    const s = st[o.stage] || {};
    const now = E('div', 'fl-now' + (o.due_k === 'late' ? ' late' : ''));
    now.append(E('b', null, `${s.n ? `${s.n}단계 ` : ''}${s.name || ''}`), document.createTextNode(` · ${s.what || ''}`));
    const meta = [o.days != null ? `${stay(o.days)}${o.since ? `(${when(o.since)}부터)` : ''}` : o.changed && !['listing', 'selling'].includes(o.stage) ? `${when(o.changed)}에 마지막으로 바뀜` : '',
      o.due_t ? `${o.k === 'a' ? '답 기한' : '발송기한'} ${o.due_t}` : '', o.stuck ? `${s.sla}일 넘게 머묾` : ''].filter(Boolean);
    if (meta.length) { now.append(E('br'), document.createTextNode(meta.join(' · '))); }
    const who = (s.jobs || []).map((j) => data.agents[j]).filter(Boolean);
    if (who.length) { now.append(E('br'), document.createTextNode(`담당 ${who.map((a) => `${role(a.name)}${a.state === 'running' ? '(일하는 중)' : a.next ? `(다음 ${when(a.next)})` : ''}`).join(', ')}`)); }
    if (s.level === 0) now.append(E('br'), document.createTextNode('사람이 직접 하는 단계예요.'));
    body.append(now, E('div', 'fl-empty', '불러오는 중…'));
    d.append(head, body); h.focus({ preventScroll: true });
    try {
      const cx = new URLSearchParams({ k: o.k, id: o.id, stage: o.stage || '', sub: o.sub || '', days: o.days ?? '', stuck: o.stuck ? '1' : '' });
      const r = await (window.barunFetch || fetch)(`/api/flow/obj?${cx}`);
      if (openObj !== o) return;
      if (!r.ok) throw new Error(`서버 응답 ${r.status}`);   // 2026-11-06: 503이면 '읽는 중…'에 영영 멈춰 있었음
      const j = await r.json(); if (openObj !== o) return; body.lastChild.remove();
      if (j.kind === 'o') orderBody(body, j, o); else if (j.kind === 'p') productBody(body, j, o); else askBody(body, j, o);
      if ((j.acts || []).length) now.after(sect('할 수 있는 일', actsBox(j.acts, o, body)));
    } catch (e) { if (openObj === o && body.lastChild) { body.lastChild.textContent = '불러오지 못했어요. 다시 눌러 주세요.'; body.lastChild.title = `원문: ${e.message}`; } }
  }
  const kv = (pairs) => { const dl = E('dl', 'fl-kv'); for (const [k, v] of pairs) if (v != null && v !== '') { dl.append(E('dt', null, k), E('dd', null, noE(v))); } return dl; };
  const sect = (t, el, id) => { const s = E('section'); if (id) s.dataset.sec = id; s.append(E('h4', null, t), el); return s; };
  function orderBody(body, j, o) {
    const ol = E('ol', 'fl-steps');
    for (const s of j.steps) {
      const li = E('li', s.state); li.append(s.state === 'done' ? ic('check', 'mk') : E('span', 'mk', s.state === 'now' ? '●' : ''), E('span', 'nm', s.name), E('span', 'at', s.at ? when(s.at) : s.state === 'now' ? '지금' : ''));
      ol.append(li);
    }
    if (j.stage === 'claim') { const li = E('li', 'now'); li.append(E('span', 'mk', '!'), E('span', 'nm', '취소·반품·교환 요청'), E('span', 'at', '지금')); ol.append(li); }
    body.append(sect('지나온 길', ol));
    const live = data.cards.filter((c) => (c.objs || []).includes(o.id) || (j.cards || []).some((x) => x.id === c.id));
    const past = (j.cards || []).filter((x) => !live.some((c) => c.id === x.id));
    if (live.length || past.length) {
      const box = E('div'); box.style.display = 'grid'; box.style.gap = '8px';
      for (const c of live) box.append(hcard(c));
      for (const c of past.slice(0, 6)) {
        const l = E('div', 'fl-past'); l.append(E('span', 'tm', when(c.created)), E('span', null, `${noE(c.title)} · ${PAST[c.state] || c.state}`));
        if (/^https?:/.test(c.ref || '')) { const a = E('a', null, '디스코드에서 보기'); a.href = c.ref; a.target = '_blank'; a.rel = 'noopener'; l.append(a); }
        box.append(l);
      }
      body.append(sect(live.length ? `이 주문의 카드 · 사람 차례 ${live.length}` : '이 주문의 카드', box, 'cards'));
    }
    if ((j.handlings || []).length) body.append(sect('처리 방식 정하기', handleBox(j, o), 'handle'));
    if (j.edit) body.append(sect(`시트 칸 고치기 · ${j.edit.tab} ${j.edit.row}행`, editBox(j, o), 'edit'));
    else if (o.stage === 'new') body.append(E('div', 'fl-info', '시트 줄이 아직 없어요. ① 주문·발송 회차가 만들어요.'));
    const od = j.order || {}, r = (j.rows || [])[0] || {}, l = j.ledger || {};
    body.append(sect('주문', kv([['플랫폼', o.acct && window.platName ? window.platName('coupang', o.acct, o.acct_label) : o.plat], ['주문번호', od.order_id], ['주문 시각', (od.ordered_at || '').replace('T', ' ').slice(0, 16)], ['결제 금액', od.paid ? won(od.paid) : ''],
      ['발송기한', od.due ? `${String(od.due).slice(0, 10)}${j.due_t ? ` (${j.due_t})` : ''}` : ''], ['플랫폼 상태', ko(od.status_label || od.status)], ['처리 방식', l.handling], ['시트', r.tab ? `${r.tab} ${r.row}행${(j.rows || []).length > 1 ? ` 외 ${j.rows.length - 1}줄` : ''}` : '']])));
    body.append(sect('구매·배송', kv([['진행상태', ko(r.progress)], ['구매처', r.shop], ['공홈주문번호', r.shop_order], ['공홈가', r.shop_price], ['해외송장', [ko(r.intl_carrier), r.intl_tracking].filter(Boolean).join(' ')],
      ['배대지', [r.fwd_center, r.fwd_request].filter(Boolean).join(' · ')], ['배송방식', r.ship_mode], ['국내송장', r.kr_invoice || od.invoice], ['택배사', ko(od.courier)], ['보낼 수량', r.send_qty], ['문제', r.problem], ['메모', r.memo]])));
    const ev = E('ul', 'fl-ev');
    for (const e of j.events || []) {
      const li = E('li'); li.append(E('span', 'tm', when(e.at)));
      const t = E('span'); t.append(document.createTextNode(`${e.label}: ${e.old ? `${ko(e.old)} → ` : ''}${ko(e.new) || '빈칸'}`), E('div', 'src', e.src)); li.append(t); ev.append(li);
    }
    if (!(j.events || []).length) ev.append(E('li', null, '바뀐 기록이 아직 없어요.'));
    body.append(sect('바뀐 기록', ev));
  }
  // 처리 방식(재고발송·해외구매·예외) — 장부에 남기면 ① 회차가 그대로(ops/orderdb.mark, 데이터 화면 '처리 방식'과 같음)
  function handleBox(j, o) {
    const w = E('div'), hs = E('div', 'fl-hs'), out = E('div', 'fl-out'); out.hidden = true;
    const cur = (j.ledger || {}).handling || '';
    for (const h of j.handlings) {
      const b = E('button', 'btn sm' + (h === '해외구매' ? ' primary' : ''), h); b.type = 'button'; b.setAttribute('aria-pressed', String(cur === h));
      b.onclick = async () => { const r = await act({ action: 'db', kind: 'order_mark', key: j.id, handling: h, memo: '업무 흐름에서' }, b, out); if (r && r.ok) reopen(o); };
      hs.append(b);
    }
    w.append(hs, E('p', 'small muted', cur && cur !== '미정' ? `지금은 ${cur}로 정해져 있어요.` : '아직 정하지 않았어요. 고르면 장부에 남고, 다음 회차가 그대로 처리해요.'), out);
    return w;
  }
  // 이 단계를 넘기는 시트 칸 + 메모 — 바꾼 칸만 보냄(ops/orderedit: 줄·먼저 고친 사람·회차 확인)
  function editBox(j, o) {
    const ed = j.edit, f = E('div', 'fl-form'), out = E('div', 'fl-out'); out.hidden = true;
    const ins = ed.fields.map(([col, k, v]) => {
      const lab = E('label'); const i = k === 'memo' ? E('textarea') : E('input'); if (k !== 'memo') i.type = 'text';
      i.value = v; i.dataset.old = v; i.autocomplete = 'off'; i.spellcheck = false;
      i.oninput = () => i.classList.toggle('ch', i.value.trim() !== i.dataset.old);
      lab.append(E('span', null, col), i); f.append(lab);
      return [col, i];
    });
    const save = E('button', 'btn sm primary', '시트에 저장'); save.type = 'button';
    save.onclick = async () => {
      const edits = ins.filter(([, i]) => i.value.trim() !== i.dataset.old)
        .map(([col, i]) => ({ tab: ed.tab, row: ed.row, key: ed.key, col, old: i.dataset.old, new: i.value.trim(), ident: ed.ident }));
      if (!edits.length) { out.hidden = false; out.className = 'fl-out'; out.textContent = '바뀐 칸이 없어요.'; return; }
      const r = await act({ action: 'db', kind: 'sheet_edit', edits }, save, out);
      if (r && r.ok) reopen(o);
    };
    const row = E('div', 'fl-acts'); row.append(save); f.append(row, out);
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save.click(); } });
    return f;
  }
  // 에이전트에게 맡기기 — 공용 '맡기기' 창(index.html openAsk → #작업판 스레드)에 이 객체 설명·할 일을 미리 적어 둠, 사람이 고치고 보냄
  function assign(text) {
    if (!window.openAsk) return;
    window.openAsk();
    const t = document.getElementById('task-text'); if (!t) return;
    t.value = noE(text); setTimeout(() => { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }, 40);
  }
  // 할 수 있는 일 — 서버가 단계·상태로 고른 조치(dashboard/flowacts.py). 맨 앞이 지금 가장 할 만한 것
  function actsBox(list, o, body) {
    const w = E('div'), g = E('div', 'fl-do'), out = E('div', 'fl-out'); out.hidden = true;
    for (const a of list) {
      const link = a.t === 'link', b = E(link ? 'a' : 'button', 'fl-a' + (a.main ? ' main' : ''));
      if (link) { b.href = a.url; b.target = '_blank'; b.rel = 'noopener'; } else b.type = 'button';
      const tx = E('span', 'tx'); tx.append(E('b', null, noE(a.label))); if (a.hint) tx.append(E('small', null, noE(a.hint)));
      b.append(ic(a.icon || 'arrow'), tx); if (a.hint) b.title = noE(a.hint);
      if (!link) b.onclick = () => runAct(a, b, out, o, body);
      g.append(b);
    }
    w.append(g, out);
    return w;
  }
  async function runAct(a, b, out, o, body) {
    if (a.t === 'agent') return assign(a.text);
    if (a.t === 'copy') {
      try { await navigator.clipboard.writeText(a.text); if (window.toast) window.toast(`복사했어요 · ${a.text}`); } catch (e) { if (window.toast) window.toast(`복사하지 못했어요 · ${a.text}`); }
      return;
    }
    if (a.t === 'go') {
      closeDr();
      if (a.tab === 'data') location.hash = '#data?' + encodeURIComponent(JSON.stringify({ t: a.table || 'sheet_rows', p: '', q: a.q || '' }));
      if (window.showTab) window.showTab(a.tab);
      return;
    }
    if (a.t === 'jump') {
      const s = body.querySelector(`[data-sec="${a.to}"]`); if (!s) return;
      s.scrollIntoView({ behavior: 'smooth', block: 'start' });
      s.classList.remove('fl-flash'); void s.offsetWidth; s.classList.add('fl-flash');
      const f = s.querySelector('input, select, button'); if (f) f.focus({ preventScroll: true });
      return;
    }
    if (a.t === 'do' && a.ask) return askInline(a, out, o);
    if (a.t === 'run' && !confirm(`'${noE(a.label)}' 지금 시작할까요?`)) return;
    if (a.t === 'do' && a.confirm && !confirm(a.confirm)) return;
    b.disabled = true;                                    // act()의 버튼 글 되돌리기는 아이콘을 지우므로 여기서 잠금만
    try {
      const r = await act(a.t === 'run' ? { action: 'run', job: a.job } : a.body, null, out);
      if (r && r.ok && a.t === 'do') { if (a.close) closeDr(); else reopen(o); }
    } finally { b.disabled = false; }
  }
  // 이유 한 줄이 필요한 조치(문제로 표시) — 결과 줄 자리에 입력칸
  function askInline(a, out, o) {
    out.hidden = false; out.className = 'fl-out'; out.textContent = '';
    const i = E('input', 'fl-in'); i.type = 'text'; i.placeholder = a.ask; i.setAttribute('aria-label', a.ask);
    const ok = E('button', 'btn sm primary', a.label); ok.type = 'button';
    const go = async () => {
      const why = i.value.trim(); if (!why) { i.focus(); return; }
      ok.disabled = true;
      const r = await act(Object.assign({}, a.body, { why, todo: '' }), null, out);
      if (r && r.ok) reopen(o); else ok.disabled = false;
    };
    ok.onclick = go; i.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    out.append(i, ok); i.focus();
  }
  // 버튼 뒤 서랍을 새 자료로(그 객체가 다른 단계로 옮겨 갔어도 같은 id로 다시 엶)
  function reopen(o) {
    if (!data || $('fl-dr').hidden) return;
    const n = data.objs.find((x) => x.id === o.id);
    setTimeout(() => openDr(n || o, lastFocus), 300);
  }

  // ── 사람 차례 카드(서랍) — 할 일 화면과 같은 버튼 + 이 카드가 말하는 주문 + 칸 옮기기 ──
  function openCard(c, from) {
    lastFocus = from || document.activeElement; openObj = c;
    const d = $('fl-dr'); d.hidden = false; $('fl-scrim').hidden = false; d.textContent = '';
    const st = Object.fromEntries(data.stages.map((s) => [s.id, s])), s = st[c.stage] || {};
    const head = E('div', 'fl-dr-h'); const h = E('h2', null, noE(c.title)); h.tabIndex = -1;
    h.append(E('div', 'sub', [CST[c.state] || c.state, c.ack ? '보는 중' : '', c.count > 1 ? `${c.count}번째 알림` : '', when(c.at)].filter(Boolean).join(' · ')));
    const x = E('button', 'fl-x'); x.append(ic('x')); x.type = 'button'; x.setAttribute('aria-label', '닫기'); x.onclick = closeDr;
    head.append(h, x);
    const body = E('div', 'fl-dr-b');
    const now = E('div', 'fl-now'); now.append(E('b', null, `${s.n ? `${s.n}단계 ` : ''}${s.name || ''}`), document.createTextNode(' 칸'));
    if (c.moved) now.append(document.createTextNode(` · ${noE(c.moved)} 님이 옮김`));
    else if ((c.objs || []).length) now.append(document.createTextNode(' · 이 카드의 주문이 있는 단계'));
    body.append(now);
    if (c.todo) body.append(E('div', 'fl-todo', '할 일 · ' + noE(c.todo).replace(/\*\*/g, '')));
    const out = E('div', 'fl-out'); out.hidden = true;
    const acts = E('div', 'fl-acts');
    const B = (lab, a, cls, extra, close) => {
      const b = E('button', 'btn sm ' + (cls || ''), lab); b.type = 'button';
      b.onclick = async () => { const r = await act(Object.assign({ action: a, key: c.key }, extra || {}), b, out); if (r && r.ok) { if (close) closeDr(); else { const n = data.cards.find((y) => y.id === c.id); if (n) openCard(n, lastFocus); } } };
      acts.append(b);
    };
    if (c.act) {
      if (c.approval) { B('승인', 'approve', 'primary', null, true); B('거절', 'reject', 'danger', null, true); }
      (c.choices || []).forEach((ch, k) => B(noE(ch), 'choose', k ? 'weak' : 'primary', { idx: k }, true));
      if (c.key !== 'login-needed') B('처리했어요', 'done', c.approval || (c.choices || []).length ? '' : 'primary', null, true);   // 로그인 카드는 사이트별로 로그인되면 저절로 줄어듦
      else (c.sites || []).forEach((st) => {   // 사이트 줄마다 — 자동 확인되는 곳은 확인 후, 확인 길이 없는 곳은 바로 지움(notify/logins.confirm)
        const b = E('button', 'btn sm weak', `${st.replace(/\s*\(.*\)$/, '').slice(0, 16)} 로그인했어요`); b.type = 'button'; b.title = st;
        b.onclick = async () => { const lab = b.textContent; b.textContent = '확인 중…'; const r = await act({ action: 'login_ok', key: st }, b, out); b.textContent = lab;
          if (r && r.ok) { const n = data.cards.find((y) => y.id === c.id); if (n) openCard(n, lastFocus); else closeDr(); } };
        acts.append(b);
      });
      if (!c.ack) B('보는 중으로 표시', 'ack', 'ghost');
      if (c.state !== 'snoozed') B('내일 아침으로 미루기', 'snooze', 'ghost', null, true);
    } else acts.append(E('span', 'small muted', '이 카드는 디스코드 스레드에서 답해 주세요.'));
    if (/^https?:/.test(c.ref || '')) { const a = E('a', 'btn sm ghost', '디스코드에서 열기'); a.append(ic('external')); a.href = c.ref; a.target = '_blank'; a.rel = 'noopener'; acts.append(a); }
    body.append(acts, out);
    if (c.body) body.append(sect('내용', E('pre', 'fl-pre', noE(c.body))));
    const os = (c.objs || []).map((id) => data.objs.find((y) => y.id === id)).filter(Boolean);
    if (os.length) { const box = E('div', 'fl-objs'); for (const y of os) box.append(obj(y)); body.append(sect(`이 카드의 주문 ${os.length}`, box)); }
    // 칸 옮기기 — 낱말 규칙이 엉뚱한 칸에 두었으면 여기서(dashboard/flow.py set_card_stage)
    const mv = E('div', 'fl-mv'), sel = E('select', 'fl-sel'); sel.setAttribute('aria-label', '이 카드를 둘 단계');
    for (const x2 of data.stages) { const op = E('option', null, `${x2.n ? `${x2.n}. ` : ''}${x2.name}`); op.value = x2.id; op.selected = x2.id === c.stage; sel.append(op); }
    const mb = E('button', 'btn sm', '옮기기'); mb.type = 'button';
    mb.onclick = async () => { if (sel.value === c.stage) return; const r = await act({ action: 'flow_stage', key: c.id, stage: sel.value }, mb, out); if (r && r.ok) { const n = data.cards.find((y) => y.id === c.id); if (n) openCard(n, lastFocus); } };
    mv.append(sel, mb);
    if (c.moved) {
      const back = E('button', 'btn sm ghost', `${(st[c.auto] || {}).name || '원래'} 칸으로 되돌리기`); back.type = 'button';
      back.onclick = async () => { const r = await act({ action: 'flow_stage', key: c.id, stage: '' }, back, out); if (r && r.ok) { const n = data.cards.find((y) => y.id === c.id); if (n) openCard(n, lastFocus); } };
      mv.append(back);
    }
    body.append(sect('칸 옮기기', mv));
    d.append(head, body); h.focus({ preventScroll: true });
  }

  function productBody(body, j, o) {
    const ld = j.lead || {};
    if (o.note) body.append(E('div', 'fl-todo', '반려 사유 · ' + noE(o.note)));
    if (ld.lead_id) body.append(sect('소싱', kv([['장부 줄', ld.lead_id], ['상태', ld.state], ['수량', ld.quantity], ['원가', ld.cost_krw ? won(ld.cost_krw) : ''], ['시장 최저가', ld.market_krw ? won(ld.market_krw) : ''],
      ['예상 이익', ld.profit ? won(ld.profit) : ''], ['기다리는 것', ld.waiting], ['메모', ld.reason]])));
    const ls = j.listings || [];
    if (ls.length) {                                    // 쿠팡은 옵션마다 한 줄 — 상품 정보 한 번 + 옵션 목록
      const x = ls[0], cp = x.platform === 'coupang';
      body.append(sect(`${cp ? '쿠팡' : '네이버'} 판매 목록`, kv([['상태', NVS[x.status] || ko(x.status)], ['상품명', cp ? (x.name || '').split(' · ')[0] : x.name], [cp ? '등록상품 번호' : '상품 번호', x.product_no || x.listing_id],
        ['가격', !cp && x.price ? won(x.price) : ''], ['옵션', cp ? `${ls.length}개` : '']])));
      if (cp) {
        const ul = E('ul', 'fl-ev');
        for (const y of ls.slice(0, 40)) { const li = E('li'); li.append(E('span', 'tm', y.price ? won(y.price) : ''), E('span', null, noE((y.name || '').split(' · ').slice(1).join(' · ') || y.listing_id))); ul.append(li); }
        const dd = E('details'); dd.append(E('summary', 'small', `옵션 ${ls.length}개 보기`), ul); body.append(dd);
      }
    }
    if ((j.states || []).length) {
      const ul = E('ul', 'fl-ev');
      for (const h of j.states) { const li = E('li'); const t = E('span'); t.append(document.createTextNode(ko(h.label))); if (h.note) t.append(E('div', 'src', noE(h.note))); li.append(E('span', 'tm', when(h.at)), t); ul.append(li); }
      body.append(sect('플랫폼 상태 이력', ul));
    } else if (['listing', 'selling'].includes(o.stage)) body.append(E('div', 'fl-info', '상태 이력이 아직 없어요. 매일 04:40에 판매 목록을 읽을 때부터 쌓여요.'));
    if (o.stage === 'cost') body.append(E('div', 'fl-info', '원가를 알려 주시면 수익을 계산해요.'));
    if ((j.regs || []).length) { const ul = E('ul', 'fl-ev'); for (const r of j.regs) { const li = E('li'); li.append(E('span', 'tm', when(r.at)), E('span', null, `${r.platform === 'coupang' ? '쿠팡' : '네이버'} ${r.action} ${r.ok ? '성공' : '실패'}${r.summary ? ` · ${noE(r.summary)}` : ''}`)); ul.append(li); } body.append(sect('등록 기록', ul)); }
    if ((j.history || []).length) { const ul = E('ul', 'fl-ev'); for (const h of j.history) { const li = E('li'); li.append(E('span', 'tm', when(h.at)), E('span', null, `${h.state}${h.memo ? ` · ${noE(h.memo)}` : ''}`)); ul.append(li); } body.append(sect('소싱 이력', ul)); }
    if (!ld.lead_id && !(j.listings || []).length && o.stage !== 'cost') body.append(E('div', 'fl-empty', '아직 기록이 없어요.'));
  }
  function askBody(body, j, o) {
    const a = j.ask || {};
    body.append(sect('보낸 문의', kv([['사이트', a.site], ['글번호', a.no], ['상태', a.state], ['보낸 때', (a.sent_at || '').replace('T', ' ').slice(0, 16)], ['답 기한', a.due], ['보낸 사람', a.by], ['답', a.answer], ['메모', a.memo]])));
  }

  if (!install()) document.addEventListener('DOMContentLoaded', install);
})();
