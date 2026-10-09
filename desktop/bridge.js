(() => {
  'use strict';
  const parameters = new URLSearchParams(location.search);
  const requestedPort = parameters.get('bridgePort');
  const port = /^\d{4,5}$/.test(requestedPort || '') ? Number(requestedPort) : 8078;
  const base = 'http://127.0.0.1:' + port;
  let token;
  let connection;
  let events;
  let queue = Promise.resolve();
  async function request(route, value) {
    const response = await fetch(base + route, { method: value === undefined ? 'GET' : 'POST', headers: { ...(token ? { 'X-Muyu-Token': token } : {}), ...(value !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: value === undefined ? undefined : JSON.stringify(value), signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('桌面连接失败');
    return response.json();
  }
  const bridge = {
    connected: false,
    async connect(localState) {
      if (connection) return connection;
      connection = (async () => {
        const health = await request('/api/health');
        if (health.app !== 'dafeyu-muyu') throw new Error('桌面模式尚未启动');
        token = health.token;
        const state = await request('/api/import', localState);
        bridge.connected = true;
        events = new EventSource(base + '/api/events?token=' + encodeURIComponent(token));
        events.onmessage = event => {
          try { document.dispatchEvent(new CustomEvent('muyu-remote-state', { detail: JSON.parse(event.data) })); } catch { /* Ignore a malformed update. */ }
        };
        return state;
      })().catch(error => { connection = null; throw error; });
      return connection;
    },
    mutate(action) {
      queue = queue.catch(() => {}).then(() => request('/api/action', action));
      return queue;
    },
    async openPet() {
      await request('/api/pet', {});
      for (let i = 0; i < 40; i++) {
        const status = await request('/api/pet/status');
        if (status.running && status.telemetry?.ready && status.telemetry.visible) return status;
        if (status.telemetry?.error) throw new Error(status.telemetry.error);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error('悬浮窗启动较慢，请再次点击。');
    }
  };
  window.muyuDesktop = bridge;
  window.muyuDesktopAutoConnect = parameters.get('desktop') === '1';
})();
