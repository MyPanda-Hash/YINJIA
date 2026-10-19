/**
 * 数采模拟设备(代替一台真实 WiFi 秤):周期性上报重量 + 心跳,偶发越限制造报警。
 * 用法: node tools/archive/_dc-sim/_dc-sim.cjs [deviceCode] [dcKey] [intervalMs] [count]  (count=0 无限)
 * 环境: DC_BASE 默认 http://127.0.0.1:8090
 */
const BASE = process.env.DC_BASE || 'http://127.0.0.1:8090';
const DEV = process.argv[2] || 'SIM-SCALE-01';
const KEY = process.argv[3] || 'sim-key-2026';
const IV = Number(process.argv[4] || 4000);
const N = Number(process.argv[5] || 0);

const post = async (path, body) => {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DC-Key': KEY }, body: JSON.stringify(body) });
  let json = null; const t = await res.text();
  try { json = JSON.parse(t) } catch (e) { json = { raw: t } }
  return { status: res.status, body: json };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const hb = await post('/api/dc/heartbeat', { deviceCode: DEV });
  console.log('HEARTBEAT ' + hb.status + ' ' + JSON.stringify(hb.body.data || hb.body.message));
  let i = 0;
  while (true) {
    i += 1;
    const overLimit = i % 8 === 0;
    const w = overLimit ? 55.6 : Math.round((20 + Math.random() * 8) * 10) / 10;
    const r = await post('/api/dc/ingest', { deviceCode: DEV, values: [{ pointCode: 'W01', value: w }] });
    const ok = r.body && r.body.code === 200;
    console.log('PUSH #' + i + ' w=' + w + (overLimit ? ' (越限)' : '') + ' ' + r.status + ' ' + (ok ? 'accepted=' + (r.body.data.accepted) : JSON.stringify(r.body.message)));
    if (N > 0 && i >= N) { console.log('DONE ' + i + ' pushes'); break }
    await sleep(IV);
  }
})();
