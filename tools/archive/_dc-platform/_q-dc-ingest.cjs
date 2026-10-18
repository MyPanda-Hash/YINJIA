/** _q-dc-ingest.cjs — 数采平台端到端探针:网关/绑定/采集点/规则 → 硬件 ingest → 监控/报警/统计 → 权限闸门 2026-10-18 */
const BASE = 'http://127.0.0.1:8090'
const FACTORY = process.argv[2] || 'YJ_TEST'
const ACC = process.argv[3] || 'admin'
const PWD = process.argv[4] || '123456'
const CP_PWD = process.argv[5] || '123456'
const GW_CODE = 'GW-TEST'
const GW_KEY = 'probe-key-123'
const DEV_CODE = 'DZ-001'
const POINT_CODE = 'P01'
const RULE_NAME = '定时采集规则'

async function call(method, path, opts) {
  const o = opts || {}
  const headers = { 'Content-Type': 'application/json' }
  if (o.token) headers.Authorization = 'Bearer ' + o.token
  if (o.key) headers['X-DC-Key'] = o.key
  const res = await fetch(BASE + path, { method: method, headers: headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) })
  let json = null
  const text = await res.text()
  try { json = JSON.parse(text) } catch (e) { json = { raw: text.slice(0, 300) } }
  return { status: res.status, json: json }
}
function data(r) { return r.json && r.json.data !== undefined ? r.json.data : null }
function brief(v, n) { const s = JSON.stringify(v); return s && s.length > (n || 400) ? s.slice(0, n || 400) + '...' : s }
function say(tag, v) { console.log(tag + ' ' + (typeof v === 'string' ? v : brief(v))) }

async function main() {
  const lr = await call('POST', '/api/auth/login', { body: { userName: ACC, password: PWD, factory: FACTORY } })
  const token = data(lr) && data(lr).token
  if (!token) { say('LOGIN_FAIL', lr); process.exit(1) }
  say('LOGIN', { factory: FACTORY, account: ACC, role: (data(lr).user || {}).role, isAdmin: (data(lr).user || {}).isAdmin })

  let cfg = await call('GET', '/api/dc/config', { token: token })
  const before = data(cfg)
  const dev = (before.devices || []).find((d) => d.code === DEV_CODE) || (before.devices || [])[0]
  if (!dev) { say('NO_DEVICE', before); process.exit(1) }
  say('CFG_BEFORE', { kpis: before.kpis, dev: { id: dev.id, code: dev.code, name: dev.name, type: dev.type, progress: dev.progress, missingTip: dev.missingTip } })

  const gwOld = (before.gateways || []).find((g) => g.code === GW_CODE)
  const gwBody = { code: GW_CODE, name: '测试网关', protocol: 'TCP', host: '127.0.0.1', port: 9000, remark: 'E2E 探针(测试账套)', apiKey: GW_KEY }
  if (gwOld) gwBody.id = gwOld.id
  const gwSave = await call('POST', '/api/dc/gateway/save', { token: token, body: gwBody })
  say('GW_SAVE', { status: gwSave.status, code: gwSave.json.code, data: data(gwSave) })
  if (gwSave.json.code !== 200) process.exit(1)
  const gwId = data(gwSave).id

  const bind = await call('POST', '/api/dc/device/save', { token: token, body: {
    id: dev.id, code: dev.code, name: dev.name, type: dev.type, model: dev.model, serialNo: dev.serialNo,
    gatewayId: gwId, ip: dev.ip, port: dev.port, workshop: dev.workshop, projectCode: dev.projectCode,
    scadaDrawn: dev.scadaDrawn, heartbeatSeconds: dev.heartbeatSeconds || 60, remark: dev.remark } })
  say('BIND', { status: bind.status, code: bind.json.code, data: data(bind) })

  cfg = await call('GET', '/api/dc/config', { token: token })
  const mid = data(cfg)
  const dev2 = (mid.devices || []).find((d) => d.id === dev.id)
  say('CFG_AFTER_BIND', { progress: dev2.progress, gatewayName: dev2.gatewayName, checks: dev2.checks, missingTip: dev2.missingTip, gwKeySet: (mid.gateways || []).map((g) => ({ code: g.code, keySet: g.keySet, deviceCount: g.deviceCount })) })

  const pl = await call('GET', '/api/dc/points?deviceId=' + dev.id, { token: token })
  const oldPt = (data(pl) || []).find((p) => p.code === POINT_CODE)
  const ptBody = { deviceId: dev.id, code: POINT_CODE, name: '重量', dataType: '数值', unit: 'kg', freqSeconds: 5, lowLimit: 0, highLimit: 50, sortNo: 1, remark: 'E2E 探针' }
  if (oldPt) ptBody.id = oldPt.id
  const ptSave = await call('POST', '/api/dc/point/save', { token: token, body: ptBody })
  say('POINT_SAVE', { status: ptSave.status, code: ptSave.json.code, data: data(ptSave) })

  const rl = await call('GET', '/api/dc/rules?deviceId=' + dev.id, { token: token })
  const oldRule = (data(rl) || []).find((r) => r.name === RULE_NAME)
  const ruleBody = { deviceId: dev.id, name: RULE_NAME, ruleType: '定时采集', expression: '', params: '采样次数=3', enabled: true, remark: 'E2E 探针' }
  if (oldRule) ruleBody.id = oldRule.id
  const ruleSave = await call('POST', '/api/dc/rule/save', { token: token, body: ruleBody })
  say('RULE_SAVE', { status: ruleSave.status, code: ruleSave.json.code, data: data(ruleSave) })

  cfg = await call('GET', '/api/dc/config', { token: token })
  const after = data(cfg)
  const dev3 = (after.devices || []).find((d) => d.id === dev.id)
  say('CFG_AFTER_ALL', { kpis: after.kpis, progress: dev3.progress, pointCount: dev3.pointCount, ruleCount: dev3.ruleCount, checks: dev3.checks, missingTip: dev3.missingTip })

  const ingestBody = { gatewayCode: GW_CODE, deviceCode: dev.code, values: [{ pointCode: POINT_CODE, value: 12.5 }] }
  const ing1 = await call('POST', '/api/dc/ingest', { key: GW_KEY, body: ingestBody })
  say('INGEST_OK', { status: ing1.status, code: ing1.json.code, message: ing1.json.message, data: data(ing1) })

  const hb = await call('POST', '/api/dc/heartbeat', { key: GW_KEY, body: { deviceCode: dev.code } })
  say('HEARTBEAT', { status: hb.status, code: hb.json.code, message: hb.json.message, data: data(hb) })

  const mon = await call('GET', '/api/dc/monitor?deviceId=' + dev.id, { token: token })
  const m = data(mon) || {}
  const mdev = (m.devices || []).find((d) => d.id === dev.id) || {}
  say('MONITOR', { devOnline: mdev.online, devStatus: mdev.status, point: (m.points || []).map((p) => ({ code: p.code, valueText: p.valueText, unit: p.unit, status: p.status, at: p.at })), alarms: (m.alarms || []).length })

  const ing2 = await call('POST', '/api/dc/ingest', { key: GW_KEY, body: { gatewayCode: GW_CODE, deviceCode: dev.code, values: [{ pointCode: POINT_CODE, value: 99 }] } })
  say('INGEST_LIMIT', { status: ing2.status, code: ing2.json.code, message: ing2.json.message })
  const mon2 = await call('GET', '/api/dc/monitor?deviceId=' + dev.id, { token: token })
  const m2 = data(mon2) || {}
  say('MONITOR_ALARMS', { point: (m2.points || []).map((p) => ({ code: p.code, valueText: p.valueText, status: p.status })), alarms: (m2.alarms || []).map((a) => ({ id: a.id, level: a.level, message: a.message, valueText: a.valueText, state: a.state, handledBy: a.handledBy })).slice(0, 3) })

  const bad = await call('POST', '/api/dc/ingest', { key: 'wrong-key', body: ingestBody })
  say('INGEST_BADKEY', { status: bad.status, code: bad.json.code, message: bad.json.message })
  const nogw = await call('POST', '/api/dc/ingest', { key: GW_KEY, body: { gatewayCode: 'GW-NOT-EXIST', deviceCode: dev.code, values: [{ pointCode: POINT_CODE, value: 1 }] } })
  say('INGEST_WRONGGW', { status: nogw.status, code: nogw.json.code, message: nogw.json.message })
  const nopt = await call('POST', '/api/dc/ingest', { key: GW_KEY, body: { gatewayCode: GW_CODE, deviceCode: dev.code, values: [{ pointCode: 'P-NOT-EXIST', value: 1 }] } })
  say('INGEST_NOPOINT', { status: nopt.status, code: nopt.json.code, message: nopt.json.message })

  const today = new Date()
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  const from = new Date(today.getTime() - 7 * 86400000)
  const st = await call('GET', '/api/dc/stats?from=' + iso(from) + '&to=' + iso(today), { token: token })
  const s = data(st) || {}
  say('STATS', { summary: s.summary, dev: (s.byDevice || []).filter((d) => d.deviceCode === dev.code), alarms: s.alarms })

  const cplr = await call('POST', '/api/auth/login', { body: { userName: 'cp', password: CP_PWD, factory: FACTORY } })
  const cpToken = data(cplr) && data(cplr).token
  const cpWd = await call('POST', '/api/dc/point/save', { token: cpToken, body: { deviceId: dev.id, code: 'P-CP', name: '越权写入', dataType: '数值' } })
  const cpGw = await call('POST', '/api/dc/gateway/save', { token: cpToken, body: { code: 'GW-CP', name: '越权网关' } })
  say('CP_GUARD', { pointSaveStatus: cpWd.status, pointSaveMsg: cpWd.json.message, gatewaySaveStatus: cpGw.status })

  const after2 = await call('GET', '/api/dc/config', { token: token })
  const d4 = (data(after2).devices || []).filter((d) => d.code === 'DZ-001' || d.id === dev.id).map((d) => ({ code: d.code, progress: d.progress, pointCount: d.pointCount, ruleCount: d.ruleCount, missingTip: d.missingTip }))
  say('CFG_FINAL', { dev: d4, gateways: (data(after2).gateways || []).map((g) => ({ code: g.code, keySet: g.keySet, deviceCount: g.deviceCount })) })
  console.log('DONE factory=' + FACTORY)
}
main().catch((e) => { console.error('FAIL ' + e.message); process.exit(1) })