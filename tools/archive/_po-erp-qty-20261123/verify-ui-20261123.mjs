const PORT = 9333;
const OUT = 'C:/Users/Lenovo/ego/po-erp-qty-20261123';
const DOC = 'YJ-20261023-05';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const app = list.filter((t) => t.type === 'page').find((t) => (t.url || '').includes('127.0.0.1:8090')) || list.filter((t) => t.type === 'page')[0];
let nextId = 1;
const pending = new Map();
const ws = new WebSocket(app.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(JSON.stringify(m.error))); else resolve(m.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1720, height: 1020, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `http://127.0.0.1:8090/#/panelx/list/PU_ORDER?docNo=${DOC}` });
await sleep(8000);

const ev = async (e) => {
  const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result?.value;
};

const pick = await ev(`(() => {
  const ths = [...document.querySelectorAll('th')].filter((x) => (x.innerText || '').trim().startsWith('金蝶未入库数量'));
  const visible = ths.map((th) => ({ th, r: th.getBoundingClientRect() }))
    .filter((o) => o.r.width > 0)
    .sort((a, b) => a.r.x - b.r.x);
  if (!visible.length) return { ok: false, count: ths.length };
  const { th, r } = visible[0];
  // 滚到能看见该列(它的 x 若超出视口,横向滚动）
  let sc = th.parentElement;
  while (sc && sc !== document.body) {
    const st = getComputedStyle(sc);
    if (sc.scrollWidth > sc.clientWidth + 5 && /auto|scroll/.test(st.overflowX)) break;
    sc = sc.parentElement;
  }
  if (sc && sc !== document.body) {
    const sr = sc.getBoundingClientRect();
    sc.scrollLeft = Math.max(0, r.x - sr.x - 120);
  }
  return { ok: true, count: visible.length, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width),
    scrolled: !!(sc && sc !== document.body) };
})()`);
await sleep(900);

const check = await ev(`(() => {
  const ths = [...document.querySelectorAll('th')].filter((x) => (x.innerText || '').trim().startsWith('金蝶未入库数量'));
  const vis = ths.map((th) => th.getBoundingClientRect()).filter((r) => r.width > 0).sort((a, b) => a.x - b.x)[0];
  if (!vis) return { ok: false };
  const cx = Math.round(vis.x + vis.width / 2), cy = Math.round(vis.y + vis.height / 2);
  const top = document.elementFromPoint(cx, cy);
  return { ok: true, viewport: { w: innerWidth, h: innerHeight },
    rect: { x: Math.round(vis.x), y: Math.round(vis.y), w: Math.round(vis.width), h: Math.round(vis.height) },
    fullyVisible: vis.x >= 0 && vis.x + vis.width <= innerWidth && vis.y >= 0 && vis.y + vis.height <= innerHeight,
    coveredBy: top ? (top.tagName + '.' + String(top.className || '').slice(0, 30)) : null };
})()`);
console.log('pick:', JSON.stringify(pick));
console.log('check:', JSON.stringify(check, null, 2));

const shot = await send('Page.captureScreenshot', { format: 'png' });
const fs = await import('node:fs');
fs.writeFileSync(OUT + '/final.png', Buffer.from(shot.data, 'base64'));
console.log('shot ->', OUT + '/final.png', fs.statSync(OUT + '/final.png').size);
ws.close();
