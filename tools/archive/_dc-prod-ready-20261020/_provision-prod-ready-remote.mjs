/**
 * _provision-prod-ready-remote.mjs — 把**服务器正式账套**的数采设备配成「五连齐备(可用)」
 *
 * 用户口径(2026-10-20):「现在把真实账套的也全写成可用的形态,实际上有一个电子秤是可用的这个不用管」
 *  ⇒ 除 DZ-001(真实电子秤,已在正常上报)外,其余设备全部补齐五项 + 采集点/规则。
 *  ⇒ **不伪造在线**:status / last_seen_at 不碰。
 *
 * 与本地迁移 tools/migrate-dc-prod-ready-20261020.sql 同口径(服务器库直连不到,只能走接口)。
 * 用法:node .../_provision-prod-ready-remote.mjs http://36.140.66.163:8090 admin 123456 YJ
 * 幂等:已齐备的设备不写;重复跑只会补缺项。
 */
const [base = 'http://36.140.66.163:8090', user = 'admin', pass = '123456', factory = 'YJ'] =
  process.argv.slice(2)
const KEEP = 'DZ-001' // 真实电子秤:点名不动

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
console.log(`[登录] ${base} factory=${factory}`)

let cfg = await req('/api/dc/config', { token })
const before = cfg.devices || []
console.log(`[初始] 设备 ${cfg.kpis?.deviceTotal} / 已绑定 ${cfg.kpis?.gatewayBound} / 配置齐备 ${cfg.kpis?.fullyReady} / 网关 ${(cfg.gateways || []).length}`)

// 快照(便于回退):只记本次会动的字段
const { writeFileSync } = await import('node:fs')
const snapPath = new URL('./snapshot-server-prod-before.json', import.meta.url)
writeFileSync(snapPath, JSON.stringify({
  at: new Date().toISOString(), base, factory,
  gateways: cfg.gateways || [],
  devices: before.map((d) => ({
    id: d.id, code: d.code, gatewayId: d.gatewayId ?? null, projectCode: d.projectCode || '',
    scadaDrawn: !!d.scadaDrawn, lastDebugAt: d.lastDebugAt || null,
  })),
}, null, 2))
console.log('[快照] 已写 snapshot-server-prod-before.json')

// ① 机动网关(没有就建):不要占用电平秤网关
let gw = (cfg.gateways || []).find((g) => g.code === 'GW-READY')
if (!gw) {
  await req('/api/dc/gateway/save', {
    method: 'POST', token,
    body: {
      code: 'GW-READY',
      name: '机动网关（配置齐备用）',
      protocol: 'HTTP',
      host: '127.0.0.1',
      port: 8090,
      remark: '2026-10-20 由 _provision-prod-ready-remote 建:仅用于让台账设备通过「绑定网关」检查,无真实硬件',
    },
  })
  cfg = await req('/api/dc/config', { token })
  gw = (cfg.gateways || []).find((g) => g.code === 'GW-READY')
  console.log('[网关] 新建 GW-READY id =', gw && gw.id)
} else {
  console.log('[网关] 复用 GW-READY id =', gw.id)
}
if (!gw) { console.log('建网关失败,终止'); process.exit(3) }

// ②③ 设备补齐 + 标记调试完成(跳过 DZ-001)
let fixed = 0, skipped = 0
for (const d of cfg.devices || []) {
  if (d.code === KEEP) { console.log('  [keep] DZ-001 真实电子秤,跳过'); continue }
  const need = !d.gatewayId || !String(d.projectCode || '').trim() || !d.scadaDrawn || !d.lastDebugAt
  if (!need) { skipped++; continue }
  await req('/api/dc/device/save', {
    method: 'POST', token,
    body: {
      id: d.id, code: d.code, name: d.name, type: d.type,
      model: d.model || '', serialNo: d.serialNo || '',
      gatewayId: d.gatewayId || gw.id,
      ip: d.ip || '', port: d.port ?? null, workshop: d.workshop || '',
      projectCode: String(d.projectCode || '').trim() || 'DC-PROJ-' + String(d.code).replace(/-/g, ''),
      scadaDrawn: true,
      remark: d.remark || '',
    },
  })
  await req('/api/dc/device/debug', { method: 'POST', token, body: { id: d.id } })
  fixed++
}
console.log(`[设备] 更新 ${fixed} 台 / 已齐备跳过 ${skipped} 台`)

// ④ 规则 + 采集点(DZ-001 不动)
cfg = await req('/api/dc/config', { token })
let ruleAdded = 0, pointAdded = 0
for (const d of cfg.devices || []) {
  if (d.code === KEEP) continue
  if (!Number(d.ruleCount)) {
    await req('/api/dc/rule/save', {
      method: 'POST', token,
      body: {
        deviceId: d.id, name: '越限报警（台账演示）', ruleType: '越限报警',
        expression: 'value > 100000', params: '', enabled: true,
        remark: '2026-10-20 _provision-prod-ready-remote:阈值取得足够大,不产生误报警',
      },
    })
    ruleAdded++
  }
  if (!Number(d.pointCount)) {
    await req('/api/dc/point/save', {
      method: 'POST', token,
      body: {
        deviceId: d.id, code: 'P01', name: '运行状态', dataType: '数值', unit: '', freqSeconds: 60,
        remark: '2026-10-20 _provision-prod-ready-remote:台账设备演示采集点',
      },
    })
    pointAdded++
  }
}
console.log(`[规则] 新增 ${ruleAdded} 条 / [采集点] 新增 ${pointAdded} 个`)

// ⑤ 复核:DZ-001 之外必须全齐;DZ-001 配置字段必须没变
const fin = await req('/api/dc/config', { token })
const k = fin.kpis || {}
const devs = fin.devices || []
const keepBefore = before.find((x) => x.code === KEEP)
const keepAfter = devs.find((x) => x.code === KEEP)
const keepSame = JSON.stringify({ g: keepBefore?.gatewayId, p: keepBefore?.projectCode, s: keepBefore?.scadaDrawn })
  === JSON.stringify({ g: keepAfter?.gatewayId, p: keepAfter?.projectCode, s: keepAfter?.scadaDrawn })
const others = devs.filter((d) => d.code !== KEEP)
const othersReady = others.filter((d) => d.configured).length
console.log(`[复核] 设备 ${k.deviceTotal} / 已绑定 ${k.gatewayBound} / 配置齐备 ${k.fullyReady} / 网关 ${(fin.gateways || []).length}`)
console.log(`[复核] DZ-001 配置未变 = ${keepSame} ; 其余 ${others.length} 台齐备 ${othersReady} 台`)
const ok = k.deviceTotal === k.gatewayBound && k.deviceTotal === k.fullyReady && keepSame && othersReady === others.length
console.log(ok ? '[PASS] 正式账套设备已全部配置齐备(电子秤未动)' : '[FAIL] 仍有缺项')
process.exit(ok ? 0 : 4)
