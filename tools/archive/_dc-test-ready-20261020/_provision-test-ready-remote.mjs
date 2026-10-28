/**
 * _provision-test-ready-remote.cjs — 把**服务器上**测试账套的数采设备置为「配置齐备(可用)」
 *
 * 为什么走接口而不是 SQL:服务器库不在本机,直连不到;而服务器现役 jar 已具备全部 DC 写接口
 * (gateway/save, device/save, device/debug, point/save, rule/save, 均 requireAdmin)。
 *
 * 做的事(与本地迁移 tools/migrate-dc-test-ready-20261020.sql 同口径):
 *   ① 复用/新建演示网关 GW-READY(HTTP 127.0.0.1:8090);
 *   ② 全部未作废设备绑它 + projectCode='DC-DEMO' + scadaDrawn=true;
 *   ③ 每台调一次「标记调试完成」(last_debug_at);
 *   ④ 每台补 1 条启用规则 + 1 个采集点;
 *   ⑤ 复核 /dc/config:已绑定/配置齐备 必须等于设备数。
 * **不伪造在线**:status / last_seen_at 不碰(无硬件就是离线)。
 *
 * 用法:node tools/archive/_dc-test-ready-20261020/_provision-test-ready-remote.cjs http://36.140.66.163:8090 admin 123456 YJ_TEST
 * 幂等:重复跑只会补缺项;已齐备的设备不再写。
 */
const [base = 'http://36.140.66.163:8090', user = 'admin', pass = '123456', factory = 'YJ_TEST'] =
  process.argv.slice(2)

async function req(path, { method = 'GET', body, token } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  let json
  try { json = JSON.parse(text) } catch { throw new Error(`HTTP ${r.status} ${path} ${text.slice(0, 200)}`) }
  if (json && json.code && json.code !== 200) throw new Error(`HTTP ${r.status} ${path} ${json.message}`)
  return json?.data ?? json
}

const login = await req('/api/auth/login', { method: 'POST', body: { userName: user, password: pass, factory } })
const token = login?.token
if (!token) { console.log('登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(2) }
console.log(`[登录] ${base} factory=${factory} user=${user}`)

let cfg = await req('/api/dc/config', { token })
console.log(`[初始] 设备 ${cfg.kpis?.deviceTotal} / 已绑定 ${cfg.kpis?.gatewayBound} / 配置齐备 ${cfg.kpis?.fullyReady} / 网关 ${(cfg.gateways || []).length}`)

// ① 网关
let gw = (cfg.gateways || []).find((g) => g.code === 'GW-READY')
if (!gw) {
  await req('/api/dc/gateway/save', {
    method: 'POST', token,
    body: {
      code: 'GW-READY',
      name: '演示网关（配置齐备）',
      protocol: 'HTTP',
      host: '127.0.0.1',
      port: 8090,
      remark: '2026-10-20 由 _provision-test-ready-remote 建:仅用于让测试账套设备通过「绑定网关」检查,无真实硬件',
    },
  })
  cfg = await req('/api/dc/config', { token })
  gw = (cfg.gateways || []).find((g) => g.code === 'GW-READY')
  console.log('[网关] 已新建 GW-READY id =', gw && gw.id)
} else {
  console.log('[网关] 复用 GW-READY id =', gw.id)
}
if (!gw) { console.log('建网关失败,终止'); process.exit(3) }

// ②③ 设备:绑定 + 数采工程 + 组态 + 调试完成
const devices = cfg.devices || []
let devFixed = 0, devSkipped = 0
for (const d of devices) {
  const need = !d.gatewayId || !String(d.projectCode || '').trim() || !d.scadaDrawn || !d.lastDebugAt
  if (!need) { devSkipped++; continue }
  await req('/api/dc/device/save', {
    method: 'POST', token,
    body: {
      id: d.id,
      code: d.code,
      name: d.name,
      type: d.type,
      model: d.model || '',
      serialNo: d.serialNo || '',
      gatewayId: d.gatewayId || gw.id,
      ip: d.ip || '',
      port: d.port ?? null,
      workshop: d.workshop || '',
      projectCode: String(d.projectCode || '').trim() || 'DC-DEMO',
      scadaDrawn: true,
      remark: d.remark || '',
    },
  })
  await req('/api/dc/device/debug', { method: 'POST', token, body: { id: d.id } })
  devFixed++
  if (devFixed % 20 === 0) console.log(`  …已处理 ${devFixed} 台`)
}
console.log(`[设备] 更新 ${devFixed} 台 / 已齐备跳过 ${devSkipped} 台`)

// ④ 规则 + 采集点(先看现有,再接 config 的 ruleCount/pointCount)
cfg = await req('/api/dc/config', { token })
let ruleAdded = 0, pointAdded = 0
for (const d of cfg.devices || []) {
  if (!Number(d.ruleCount)) {
    await req('/api/dc/rule/save', {
      method: 'POST', token,
      body: {
        deviceId: d.id,
        name: '越限报警（演示）',
        ruleType: '越限报警',
        expression: 'value > 100000',
        params: '',
        enabled: true,
        remark: '2026-10-20 _provision-test-ready-remote:阈值取得足够大,演示不会产生报警',
      },
    })
    ruleAdded++
  }
  if (!Number(d.pointCount)) {
    await req('/api/dc/point/save', {
      method: 'POST', token,
      body: {
        deviceId: d.id,
        code: 'P01',
        name: '运行状态',
        dataType: '数值',
        unit: '',
        freqSeconds: 60,
        remark: '2026-10-20 _provision-test-ready-remote:演示用采集点,不影响真实上报',
      },
    })
    pointAdded++
  }
}
console.log(`[规则] 新增 ${ruleAdded} 条 / [采集点] 新增 ${pointAdded} 个`)

// ⑤ 复核
const fin = await req('/api/dc/config', { token })
const k = fin.kpis || {}
const devs = fin.devices || []
const withRule = devs.filter((d) => Number(d.ruleCount) > 0).length
const withPoint = devs.filter((d) => Number(d.pointCount) > 0).length
console.log(`[复核] 设备 ${k.deviceTotal} / 已绑定 ${k.gatewayBound} / 配置齐备 ${k.fullyReady} / 网关 ${(fin.gateways || []).length} / 有规则 ${withRule} / 有采集点 ${withPoint}`)
const ok = k.deviceTotal === k.gatewayBound && k.deviceTotal === k.fullyReady && withRule === k.deviceTotal && withPoint === k.deviceTotal
console.log(ok ? '[PASS] 全部设备五连齐备' : '[FAIL] 仍有缺项,见上')
process.exit(ok ? 0 : 4)
