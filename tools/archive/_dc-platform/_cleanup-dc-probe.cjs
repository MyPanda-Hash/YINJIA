/**
 * 数采探针数据清理(配套 _cleanup-dc-probe.sql):
 *   1) API 软删探针建的采集点 / 规则 / 网关(网关软删会先解绑设备)
 *   2) 提示随后执行 _cleanup-dc-probe.sql 清流水表 + 复位在线态
 * 用法: node tools/archive/_dc-platform/_cleanup-dc-probe.cjs [factory] [account] [pwd]
 */
const BASE = process.env.DC_BASE || 'http://127.0.0.1:8090';
const FACTORY = process.argv[2] || 'YJ';
const ACC = process.argv[3] || 'admin';
const PWD = process.argv[4] || '123456';
const DEV = process.env.DC_DEVICE || 'DZ-001';

const call = async (method, path, token, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text) } catch (e) { json = { raw: text } }
  return { status: res.status, body: json }
}

(async () => {
  const login = await call('POST', '/api/auth/login', null, { userName: ACC, password: PWD, factory: FACTORY })
  const token = login.body && login.body.data && login.body.data.token
  if (!token) { console.log('LOGIN_FAIL ' + JSON.stringify(login.body)); process.exit(1) }
  console.log('LOGIN ok factory=' + FACTORY)
  const cfg = await call('GET', '/api/dc/config', token)
  const dev = ((cfg.body.data && cfg.body.data.devices) || []).filter(function (d) { return d.code === DEV })[0]
  if (!dev) { console.log('DEVICE_NOT_FOUND ' + DEV); process.exit(1) }
  console.log('DEV ' + JSON.stringify({ id: dev.id, code: dev.code, progress: dev.progress, gatewayId: dev.gatewayId }))
  const pts = await call('GET', '/api/dc/points?deviceId=' + dev.id, token)
  for (const p of (pts.body.data || [])) {
    const r = await call('POST', '/api/dc/point/delete', token, { id: p.id })
    console.log('DEL_POINT ' + p.code + ' ' + r.status + ' ' + (r.body.message || ''))
  }
  const rules = await call('GET', '/api/dc/rules?deviceId=' + dev.id, token)
  for (const r0 of (rules.body.data || [])) {
    const r = await call('POST', '/api/dc/rule/delete', token, { id: r0.id })
    console.log('DEL_RULE ' + r0.name + ' ' + r.status + ' ' + (r.body.message || ''))
  }
  const gws = await call('GET', '/api/dc/config', token)
  const g = (((gws.body.data || {}).gateways) || []).filter(function (x) { return x.code === (process.env.DC_GW || 'GW-TEST') })[0]
  if (g) {
    const r = await call('POST', '/api/dc/gateway/delete', token, { id: g.id })
    console.log('DEL_GW ' + g.code + ' ' + r.status + ' ' + (r.body.message || '') + ' unbind=' + JSON.stringify(r.body.data))
  } else { console.log('DEL_GW skip (not found)') }
  const after = await call('GET', '/api/dc/config', token)
  const d2 = ((after.body.data || {}).devices || []).filter(function (d) { return d.code === DEV })[0]
  console.log('AFTER ' + JSON.stringify({ kpis: after.body.data.kpis, dev: d2 && { progress: d2.progress, pointCount: d2.pointCount, ruleCount: d2.ruleCount, gatewayName: d2.gatewayName, missingTip: d2.missingTip } }))
  console.log('NEXT: 执行 _cleanup-dc-probe.sql 清 bs_dc_sample/alarm/status_log 并复位在线态')
})()