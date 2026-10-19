/**
 * _provision-scale-gateway.cjs — 真实电子秤(天翊 DZ-06)接入数采的 MES 侧准备(2026-10-19)
 *
 * 做三件事(全部走现役接口):
 *   ① 建网关 GW-DZ-01(RS232 串口桥,接入密钥 scale-demo-2026);
 *   ② 把台账里已有的 DZ-001 电子秤绑上该网关,补型号/编号/车间/数采工程/组态(五连检查拉满);
 *   ③ 建采集点 W01 重量(kg,0~200)+ 两条规则(稳定值上报 / 超量程报警)。
 *
 * 串口桥脚本见同目录 _scale-bridge.ps1;插上串口线(或蓝牙配成 COM)后可先 -Sniff 看帧格式。
 */
const BASE = process.env.DC_BASE || 'http://127.0.0.1:8090'

const GW = { code: 'GW-DZ-01', name: '电子秤串口网关', protocol: 'RS232', host: '127.0.0.1', port: 9100, apiKey: 'scale-demo-2026' }
const DEV = {
  code: 'DZ-001', name: '电子秤', type: '电子秤', model: '100kg/10g', serialNo: 'JC6120103677',
  ip: '127.0.0.1', port: 9100, workshop: '总装车间', projectCode: 'DC-PROJ-DZ01', scadaDrawn: true,
  heartbeatSeconds: 60, remark: '天翊 DZ-06 计价秤(出厂 2026-09-30),经 RS232/蓝牙串口桥上报重量',
}
const POINTS = [
  { code: 'W01', name: '重量', dataType: '数值', unit: 'kg', freqSeconds: 2, lowLimit: 0, highLimit: 200 },
]
const RULES = [
  { name: '稳定值上报', ruleType: '变化上报', expression: '', params: '读数稳定 2 秒且变化 ≥5g 才上报,避免连发' },
  { name: '超量程报警', ruleType: '越限报警', expression: 'value > 200', params: '超过 200kg 记预警(量程 100kg 的秤理论上不该出现)' },
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
  const login = await call('POST', '/api/auth/login', null, { userName: 'admin', password: '123456', factory: 'YJ' })
  const token = login.data.token

  const cfg = (await call('GET', '/api/dc/config', token)).data
  const gw0 = (cfg.gateways || []).find((g) => g.code === GW.code)
  const gwBody = { code: GW.code, name: GW.name, protocol: GW.protocol, host: GW.host, port: GW.port, remark: '电子秤串口桥(RS232/蓝牙 COM)接入用', apiKey: GW.apiKey }
  if (gw0) gwBody.id = gw0.id
  await call('POST', '/api/dc/gateway/save', token, gwBody)
  const gw = ((await call('GET', '/api/dc/config', token)).data.gateways || []).find((g) => g.code === GW.code)
  console.log('网关', GW.code, 'id=' + gw.id, 'keySet=' + gw.keySet)

  const dev0 = (cfg.devices || []).find((d) => d.code === DEV.code)
  if (!dev0) throw new Error('台账里没有 ' + DEV.code)
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
  console.log('\n结果:', JSON.stringify({
    code: after.code, name: after.name, gateway: after.gatewayName || GW.name, progress: after.progress,
    points: after.pointCount, rules: after.ruleCount, missingTip: after.missingTip,
  }))
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
