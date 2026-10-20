/** _mark-debug.cjs — 给模拟设备补一次「数据调试」标记,让五连跑到 100%。用法: node ..._mark-debug.cjs [factory] [acc] [pwd] [deviceCode] */
const BASE = process.env.DC_BASE || 'http://127.0.0.1:8090';
const FACTORY = process.argv[2] || 'YJ', ACC = process.argv[3] || 'admin', PWD = process.argv[4] || '123456', CODE = process.argv[5] || 'SIM-SCALE-01';
const call = async (m, p, t, b) => {
  const r = await fetch(BASE + p, { method: m, headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}), body: b ? JSON.stringify(b) : undefined });
  const x = await r.text(); let j = null; try { j = JSON.parse(x) } catch (e) { j = { raw: x } }
  return { status: r.status, body: j };
};
(async () => {
  const l = await call('POST', '/api/auth/login', null, { userName: ACC, password: PWD, factory: FACTORY });
  const token = l.body && l.body.data && l.body.data.token;
  if (!token) { console.log('LOGIN_FAIL'); process.exit(1) }
  const cfg = await call('GET', '/api/dc/config', token);
  const dev = ((cfg.body.data || {}).devices || []).filter((d) => d.code === CODE)[0];
  if (!dev) { console.log('DEV_NOT_FOUND ' + CODE); process.exit(1) }
  const r = await call('POST', '/api/dc/device/debug', token, { id: dev.id });
  console.log('DEBUG ' + r.status + ' ' + JSON.stringify(r.body.data || r.body.message));
  const cfg2 = await call('GET', '/api/dc/config', token);
  const d2 = ((cfg2.body.data || {}).devices || []).filter((d) => d.code === CODE)[0];
  console.log('KPI ' + JSON.stringify((cfg2.body.data || {}).kpis));
  console.log('DEV ' + JSON.stringify({ progress: d2.progress, checks: d2.checks, missingTip: d2.missingTip }));
})();
