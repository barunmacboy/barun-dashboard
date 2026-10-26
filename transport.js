/* 현황판 요청: 읽기만 제한 재시도·시간 제한, 쓰기는 중복 실행 없이 결과 확인을 안내한다. */
(function (root) {
  async function request(url, opts = {}) {
    const { timeoutMs = 15000, ...options } = opts;
    const method = (options.method || 'GET').toUpperCase();
    const read = method === 'GET' || method === 'HEAD';
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (options.signal?.aborted) controller.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, timeoutMs);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        if (read && attempt === 0 && [502, 503, 504].includes(res.status)) continue;
        return res;
      } catch (e) {
        if (options.signal?.aborted) throw e;
        if (read && attempt === 0) continue;
        throw new Error(read ? '연결이 늦어지고 있어요. 잠시 뒤 다시 확인해 주세요.' : '응답을 확인하지 못했어요. 중복 처리하지 않도록 현재 상태를 확인해 주세요.');
      } finally {
        clearTimeout(timer); options.signal?.removeEventListener('abort', abort);
      }
    }
  }
  root.BarunTransport = { request };
})(typeof window === 'undefined' ? globalThis : window);
