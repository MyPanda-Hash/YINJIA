/**
 * 数采平台可用性验证 —— 建演示网关/设备/采集点/规则(经 API,无需手点界面)
 * 说明:硬件上报 /api/dc/ingest 无登录态 ⇒ 一律落正式账套 HSDZ_MES,故演示对象也建在正式账套。
 * 用法: node tools/archive/_dc-sim/_provision-dc-sim.cjs [factory] [account] [pwd]
 * 清理: node tools/archive/_dc-platform/_cleanup-dc-probe.cjs YJ admin 123456(DC_DEVICE=SIM-SCALE-01 DC_GW=GW-SIM)
 *       再跑 _cleanup-dc-probe.sql 清流水表
 */
const BASE = process.env.DC_BASE || 'http://127.0.0.1:8090';
const FACTORY = process.argv[2] || 'YJ';
const ACC = process.argv[3] || 'admin';
const PWD = process.argv[4] || '123456';
const GW_CODE = 'GW-SIM';
const GW_KEY = 'sim-key-2026';
const DEV_CODE = 'SIM-SCALE-01';

const call = async (method, path, token, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text) } catch (e) { json = { raw: text } }
  return { status: res.status, body: json };
};

(async () => {
  const login = await call('POST', '/api/auth/login', null, { userName: ACC, password: PWD, factory: FACTORY });
  const token = login.body && login.body.data && login.body.data.token;
  if (!token) { console.log('LOGIN_FAIL ' + JSON.stringify(login.body).slice(0, 300)); process.exit(1) }
  console.log('LOGIN ok factory=' + FACTORY);

  const cfg0 = await call('GET', '/api/dc/config', token);
  let gw = ((cfg0.body.data || {}).gateways || []).filter((g) => g.code === GW_CODE)[0];
  const gwBody = {
    code: GW_CODE, name: '测试网关', protocol: 'HTTP',
    host: '127.0.0.1', port: 8099, remark: '数采平台可用性验证用,验证后可删', apiKey: GW_KEY
  };
  if (gw) { gwBody.id = gw.id }
  const gs = await call('POST', '/api/dc/gateway/save', token, gwBody);
  console.log('GW_SAVE ' + gs.status + ' ' + JSON.stringify(gs.body.data || gs.body.message));
  const cfg1 = await call('GET', '/api/dc/config', token);
  gw = ((cfg1.body.data || {}).gateways || []).filter((g) => g.code === GW_CODE)[0];
  console.log('GW ' + JSON.stringify({ id: gw && gw.id, keySet: gw && gw.keySet }));

  let dev = ((cfg1.body.data || {}).devices || []).filter((d) => d.code === DEV_CODE)[0];
  const devBody = {
    code: DEV_CODE, name: '测试电子秤', type: '电子秤', model: 'SIM-WIFI-2026', serialNo: 'SIMSN0001',
    gatewayId: gw.id, ip: '192.168.1.88', port: 9100, workshop: '数采测试车间',
    projectCode: 'SIM-PROJ', scadaDrawn: true, remark: '数采闭环测试用设备(电子秤→上报→监控→统计)'
  };
  if (dev) {
    devBody.id = dev.id;
    devBody.enabled = dev.enabled;
    devBody.heartbeatSeconds = dev.heartbeatSeconds;
    devBody.projectCode = dev.projectCode || devBody.projectCode;
    devBody.scadaDrawn = dev.scadaDrawn === true;
  }
  const ds = await call('POST', '/api/dc/device/save', token, devBody);
  console.log('DEV_SAVE ' + ds.status + ' ' + JSON.stringify(ds.body.data || ds.body.message));
  const cfg2 = await call('GET', '/api/dc/config', token);
  dev = ((cfg2.body.data || {}).devices || []).filter((d) => d.code === DEV_CODE)[0];
  console.log('DEV ' + JSON.stringify({ id: dev && dev.id, progress: dev && dev.progress, missingTip: dev && dev.missingTip }));

  const pts = await call('GET', '/api/dc/points?deviceId=' + dev.id, token);
  const existW = (pts.body.data || []).filter((p) => p.code === 'W01')[0];
  const wBody = { deviceId: dev.id, code: 'W01', name: '重量', dataType: '数值', unit: 'kg', freqSeconds: 3, lowLimit: 0, highLimit: 50 };
  if (existW) { wBody.id = existW.id }
  const ws = await call('POST', '/api/dc/point/save', token, wBody);
  console.log('POINT_W01 ' + ws.status + ' ' + JSON.stringify(ws.body.data || ws.body.message));

  const rules = await call('GET', '/api/dc/rules?deviceId=' + dev.id, token);
  const existR = (rules.body.data || []).filter((r) => r.name === '越限报警(模拟)')[0];
  const rBody = { deviceId: dev.id, name: '越限报警(模拟)', ruleType: '越限报警', expression: 'value > 50', params: '重量超过 50kg 报警', enabled: true };
  if (existR) { rBody.id = existR.id }
  const rs = await call('POST', '/api/dc/rule/save', token, rBody);
  console.log('RULE ' + rs.status + ' ' + JSON.stringify(rs.body.data || rs.body.message));

  const fin = await call('GET', '/api/dc/config', token);
  const d2 = ((fin.body.data || {}).devices || []).filter((d) => d.code === DEV_CODE)[0];
  console.log('FINAL ' + JSON.stringify({ kpis: (fin.body.data || {}).kpis, dev: d2 && { id: d2.id, code: d2.code, progress: d2.progress, pointCount: d2.pointCount, ruleCount: d2.ruleCount, checks: d2.checks, missingTip: d2.missingTip } }));
  console.log('READY deviceCode=' + DEV_CODE + ' key=' + GW_KEY + ' pointCode=W01');
})();
