// round-02:查清"缓存条数=1 但面板显示 0 条" —— 页面自己拿到的 API 数据是什么
const shot = 'C:/Users/Lenovo/ego/print-cache-offline-20261116';
const task = await taskSpace('print-cache-offline-20261116');
const page = task.page('p1');

await page.goto('http://127.0.0.1:8091/#/sys/printStation', { timeout: 30000 });
await page.waitForTimeout(6000);

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }

const diag = await page.evaluate(async () => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const card = [...document.querySelectorAll('.ps-card')].find((c) => txt(c).includes('打印缓存'));
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = localStorage.getItem(k) || '';
    ls[k] = v.length > 40 ? v.slice(0, 40) + '…(' + v.length + ')' : v;
  }
  // 页面自己的令牌去拉一次接口,看看前端到底收到什么
  const tokKey = Object.keys(ls).find((k) => /token/i.test(k)) || 'token';
  let api = null;
  try {
    const raw = localStorage.getItem(tokKey) || '';
    const clean = raw.replace(/^"|"$/g, '');
    const r = await fetch('/api/px/print/station', { headers: { Authorization: 'Bearer ' + clean } });
    const j = await r.json();
    api = {
      status: r.status,
      cacheKeys: Object.keys(j?.data?.cache || {}),
      cacheCount: j?.data?.cache?.count,
      cacheItems: (j?.data?.cache?.items || []).length,
      stationNames: (j?.data?.stations || []).map((s) => s.name),
      queueSize: j?.data?.queueSize,
    };
  } catch (e) { api = { error: String(e) }; }
  return { hash: location.hash, cardText: txt(card), localStorageKeys: Object.keys(ls), api };
});
console.log(JSON.stringify(diag, null, 2));

await page.screenshot({ path: shot + '/round-02-cache-card.png', fullPage: true });
console.log('screenshot -> round-02-cache-card.png');
