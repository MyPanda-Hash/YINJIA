/**
 * _provision-scale-remote.cjs — 在**任意一台 MES**(默认本机)上准备电子秤接入台账(2026-10-19)
 *
 * 做三件事(全走现役接口,不直连库):
 *   ① 建/改网关 GW-DZ-01(接入密钥 scale-demo-2026);
 *   ② 把设备 DZ-001 绑到该网关 + 补型号/编号/车间/数采工程/组态/心跳;
 *   ③ 建采集点 W01 重量(kg,0~200)+ 两条规则。
 *
 * 用法:node tools/archive/_dc-scale-live-20261019/_provision-scale-remote.cjs <baseUrl> [factory]
 *   例:node ... http://36.140.66.163:8090 YJ
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const FACTORY = process.argv[3] || 'YJ'
const ACC = process.env.DC_ACC || 'admin'
const PWD = process.env.DC_PWD || '123456'

const GW = { code: 'GW-DZ-01', name: '电子秤网关', protocol: 'HTTP', host: '36.140.66.163', port: 8090, apiKey: 'scale-demo-2026' }
const DEV = {
  code: 'DZ-001', name: '电子秤', type: '电子秤', model: '100kg/10g', serialNo: 'JC6120103677',
  ip: '192.168.127.36', port: 80, workshop: '总装车间', projectCode: 'DC-PROJ-DZ01', scadaDrawn: true,
  heartbeatSeconds: 60, remark: '天翊 DZ-06 计价秤(出厂 2026-09-30),经 W111 模块 HTTP 直推 MES',
}
const POINTS = [{ code: 'W01', name: '重量', dataType: '数值', unit: 'kg', freqSeconds: 2, lowLimit: 0, highLimit: 200 }]
const RULES = [
  { name: '稳定值上报', ruleType: '变化上报', expression: '', params: '读数稳定后上报,最小间隔 1 秒' },
  { name: '超量程报警', ruleType: '越限报警', expression: 'value > 200', params: '超过 200kg 记预警' },
]

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (res.status >= 400) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

;(async () => {
  const login = await call('POST', '/api/auth/login', null, { userName: ACC, password: PWD, factory: FACTORY })
  const token = login.data.token
  console.log(`[${BASE}] 登录 ok`)

  const cfg = (await call('GET', '/api/dc/config', token)).data
  const gw0 = (cfg.gateways || []).find((g) => g.code === GW.code)
  const gwBody = { code: GW.code, name: GW.name, protocol: GW.protocol, host: GW.host, port: GW.port, remark: '电子秤经 W111 模块 HTTP 直推', apiKey: GW.apiKey }
  if (gw0) gwBody.id = gw0.id
  await call('POST', '/api/dc/gateway/save', token, gwBody)
  const gw = ((await call('GET', '/api/dc/config', token)).data.gateways || []).find((g) => g.code === GW.code)
  console.log('网关', GW.code, 'id=' + gw.id, 'keySet=' + gw.keySet)

  const dev0 = (cfg.devices || []).find((d) => d.code === DEV.code)
  if (!dev0) throw new Error('服务器台账里没有 ' + DEV.code)
  await call('POST', '/api/dc/device/save', token, {
    id: dev0.id, code: DEV.code, name: DEV.name, type: DEV.type, model: DEV.model, serialNo: DEV.serialNo,
    gatewayId: gw.id, ip: DEV.ip, port: DEV.port, workshop: DEV.workshop, projectCode: DEV.projectCode,
    scadaDrawn: DEV.scadaDrawn, heartbeatSeconds: DEV.heartbeatSeconds, enabled: dev0.enabled !== false, remark: DEV.remark,
  })
  const dev = ((await call('GET', '/api/dc/config', token)).data.devices || []).find((d) => d.code === DEV.code)
  console.log('设备', DEV.code, 'id=' + dev.id, '配置度=' + dev.progress + '%', '缺:' + (dev.missingTip || '无'))

  const pts = ((await call('GET', '/api/dc/points?deviceId=' + dev.id, token)).data) || []
  for (const p of POINTS) {
    const exist = pts.find((x) => x.code === p.code)
    const body = Object.assign({ deviceId: dev.id }, p)
    if (exist) body.id = exist.id
    await call('POST', '/api/dc/point/save', token, body)
  }
  const rules = ((await call('GET', '/api/dc/rules?deviceId=' + dev.id, token)).data) || []
  for (const r of RULES) {
    const exist = rules.find((x) => x.name === r.name)
    const body = Object.assign({ deviceId: dev.id, enabled: true }, r)
    if (exist) body.id = exist.id
    await call('POST', '/api/dc/rule/save', token, body)
  }

  const after = ((await call('GET', '/api/dc/config', token)).data.devices || []).find((d) => d.code === DEV.code)
  console.log('结果:', JSON.stringify({
    code: after.code, gateway: after.gatewayId, progress: after.progress,
    points: after.pointCount, rules: after.ruleCount, missingTip: after.missingTip,
  }))
  console.log(`[下一步] 用密钥 ${GW.apiKey} 打 ${BASE}/api/dc/ingest/text 验证上报口是否存在`)
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
