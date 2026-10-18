/**
 * _rename-dc-demo.cjs — 数采台账文案口径调整(2026-10-18 用户口径)
 *
 * 用户口径:「把模拟网关改为测试网关,验收演示去掉」。
 *   · GW-SIM 名字 模拟网关(WiFi 秤验证) → 测试网关(备注改为「数采平台可用性测试用」)
 *   · GW-SCAN-01 名字 扫码枪网关(验收演示) → 扫码枪网关(备注去掉「验收演示」)
 *   · SIM-SCALE-01 名字 模拟电子秤(测试) → 测试电子秤
 *   · FX-001 备注去掉「验收演示/模拟」字样
 *   · 模拟电子秤那批报警的处理留痕去掉「模拟/演示」
 * 一律走现役接口(gateway/save、device/save、alarm/handle),不直连改库。
 */
const BASE = process.env.DC_BASE || 'http://127.0.0.1:8090'

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

  const gwWant = {
    'GW-SIM': { name: '测试网关', remark: '数采平台可用性测试用,验证后可删' },
    'GW-SCAN-01': { name: '扫码枪网关', remark: '扫码枪数据接入网关;数据由上报脚本写入,硬件接入后以真实网关为准' },
  }
  for (const g of cfg.gateways || []) {
    const w = gwWant[g.code]
    if (!w) continue
    await call('POST', '/api/dc/gateway/save', token, { id: g.id, code: g.code, name: w.name, protocol: g.protocol ? 'HTTP' : 'HTTP', host: g.host, port: g.port, remark: w.remark })
    console.log('网关', g.code, '→', w.name)
  }

  const devWant = {
    'SIM-SCALE-01': { name: '测试电子秤', remark: '数采闭环测试用设备(电子秤→上报→监控→统计)' },
    'FX-001': { name: '扫码枪', remark: '扫码枪数据经网关上报;条码按物料编码 + 批号拼接' },
  }
  for (const d of cfg.devices || []) {
    const w = devWant[d.code]
    if (!w) continue
    await call('POST', '/api/dc/device/save', token, {
      id: d.id, code: d.code, name: w.name, type: d.type, model: d.model, serialNo: d.serialNo,
      gatewayId: d.gatewayId, ip: d.ip, port: d.port, workshop: d.workshop, projectCode: d.projectCode,
      scadaDrawn: d.scadaDrawn === true, heartbeatSeconds: d.heartbeatSeconds, enabled: d.enabled !== false, remark: w.remark,
    })
    console.log('设备', d.code, '→', w.name)
  }

  // 报警处理留痕:去掉「模拟/演示」
  const mon = (await call('GET', '/api/dc/monitor?deviceId=' + (cfg.devices.find((x) => x.code === 'SIM-SCALE-01') || {}).id, token)).data
  let n = 0
  for (const a of mon.alarms || []) {
    if (a.state !== '已处理') continue
    if (/模拟|演示/.test(a.handledNote || '')) {
      await call('POST', '/api/dc/alarm/handle', token, { id: a.id, note: '测试上报产生的告警,已核对' })
      n++
    }
  }
  console.log('报警留痕改写', n, '条')

  const after = (await call('GET', '/api/dc/config', token)).data
  console.log('\n结果:')
  for (const g of after.gateways || []) console.log('  网关', g.code, '|', g.name, '|', g.online ? '在线' : '离线')
  for (const d of after.devices || []) console.log('  设备', d.code, '|', d.name, '|', d.status, '|', d.progress + '%', '|', d.remark || '')
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
