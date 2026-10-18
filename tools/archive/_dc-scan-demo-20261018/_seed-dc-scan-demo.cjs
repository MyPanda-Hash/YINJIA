/**
 * _seed-dc-scan-demo.cjs — 给数采平台造一台「扫码枪」的测试数据(2026-10-18)
 *
 * 用户口径:「给数采平台捏一个扫码枪的数据上去,过两天要验收」。
 *
 * 做什么(全部走现役接口,不直连改库):
 *   ① 网关 GW-SCAN-01(HTTP / 127.0.0.1:8100, 接入密钥 scan-demo-2026);
 *   ② 台账里已有的扫码枪 FX-001 绑定该网关 + 补数采工程/组态/心跳(设备卡片 5 项检查拉满);
 *   ③ 三个采集点:SCAN_CODE 条码内容(文本)、SCAN_RATE 读码率(数值 95~100,越下限报警)、
 *      SCAN_COUNT 扫码数量(数值/次);
 *   ④ 两条规则:读码率越限报警、变化上报;
 *   ⑤ 近 3 天流水:白班 08:00–16:30 每 12 分钟一次扫码(条码用系统里真实物料编码拼批号),
 *      每小时一条读码率(96~99.6,10-17 上午掉到 93.5 触发一次预警);
 *   ⑥ 收尾心跳 = 现在,设备在「数据监控」里显示在线、最近数据是刚才。
 *
 * ⚠ 测试数据,不是硬件真实上报:条码按物料编码+日期+流水号拼,读码率为合理区间随机值。
 *    设备/网关备注写明了来源,正式接入硬件后删设备/网关即可连带清掉(见文末清理命令)。
 *
 * 用法(仓库根,8090 必须在跑):
 *   node tools/archive/_dc-scan-demo-20261018/_seed-dc-scan-demo.cjs            # 造数
 *   node tools/archive/_dc-scan-demo-20261018/_seed-dc-scan-demo.cjs --dry-run  # 只看计划
 *
 * 清理(测试完想撤掉):
 *   设备/采集点/规则/流水/报警在库里的行按 device code FX-001 与 gateway code GW-SCAN-01 删;
 *   UI 上也可以直接在设备配置里停用(不动历史流水)。
 */
const BASE = process.env.DC_BASE || 'http://127.0.0.1:8090'
const FACTORY = process.env.DC_FACTORY || 'YJ'
const ACC = process.env.DC_ACC || 'admin'
const PWD = process.env.DC_PWD || '123456'
const DRY = process.argv.includes('--dry-run')
/** --live:不补历史,改为持续上报(验收当天开着,页面实时值才会是「正常」而不是「数据过期」) */
const LIVE = process.argv.includes('--live')

const GW = { code: 'GW-SCAN-01', name: '扫码枪网关', protocol: 'HTTP', host: '127.0.0.1', port: 8100, apiKey: 'scan-demo-2026' }
const DEV = {
  code: 'FX-001', name: '扫码枪', type: '扫码枪', model: 'SIM-SCAN-2026', serialNo: 'SCANSN2026001',
  ip: '192.168.1.89', port: 9100, workshop: '总装车间', projectCode: 'DC-PROJ-FX01', scadaDrawn: true,
  heartbeatSeconds: 60, remark: '扫码枪数据经网关上报;条码按物料编码 + 批号拼接',
}
const POINTS = [
  { code: 'SCAN_CODE', name: '条码内容', dataType: '文本', unit: '', freqSeconds: 5 },
  { code: 'SCAN_RATE', name: '读码率', dataType: '数值', unit: '%', freqSeconds: 3600, lowLimit: 95, highLimit: 100 },
  { code: 'SCAN_COUNT', name: '扫码数量', dataType: '数值', unit: '次', freqSeconds: 5 },
]
const RULES = [
  { name: '读码率越限报警', ruleType: '越限报警', expression: 'value < 95', params: '读码率低于 95% 记预警,通知设备管理员' },
  { name: '扫码变化上报', ruleType: '变化上报', expression: '', params: '读码变化即上报,最小间隔 5 秒' },
]
// mate 表里的真实物料编码(除重金属炭棒滤芯等),条码按「编码-日期-流水」拼
const MATERIALS = ['YJ-YKRS-012', 'YJ-YPS-003', 'HY-AC325+', 'M-001', 'M-003']

async function call(method, path, token, body, headers) {
  const res = await fetch(BASE + path, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, headers || {}),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (res.status >= 400) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`)
  return json
}

const pad = (n, w = 2) => String(n).padStart(w, '0')
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

/** 极简可复现随机(固定种子 -> 每次造数结果一致,便于对比截图) */
function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** 生成近 3 天(含今天)的扫码事件与每小时读码率 */
function plan() {
  const rand = rng(20261018)
  const scans = []
  const rates = []
  const today = new Date()
  for (let dayOffset = 2; dayOffset >= 0; dayOffset--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset)
    const y = ymd(day)
    // 白班 08:00–11:30、13:00–16:30,每 12 分钟一次
    for (const [h0, h1] of [[8, 11], [13, 16]]) {
      for (let h = h0; h <= h1; h++) {
        for (let m = 0; m < 60; m += 12) {
          const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, Math.floor(rand() * 50))
          if (at > today) continue
          const mat = MATERIALS[Math.floor(rand() * MATERIALS.length)]
          const seq = 1 + Math.floor(rand() * 400)
          scans.push({ at, code: `${mat}-${y}-${pad(seq, 3)}` })
        }
      }
    }
    // 每小时一条读码率(白班 9 个点)
    for (let h = 8; h <= 16; h++) {
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 55, 0)
      if (at > today) continue
      // 10-17 上午 10 点掉一次(造一条可解释的预警),其余 96.0~99.6
      const dip = dayOffset === 1 && h === 10
      const v = dip ? 93.5 : Number((96 + rand() * 3.6).toFixed(1))
      rates.push({ at, v })
    }
  }
  scans.sort((a, b) => a.at - b.at)
  rates.sort((a, b) => a.at - b.at)
  return { scans, rates }
}

async function ensureGateway(token) {
  const cfg = await call('GET', '/api/dc/config', token)
  const found = (cfg.data.gateways || []).find((g) => g.code === GW.code)
  const body = { code: GW.code, name: GW.name, protocol: GW.protocol, host: GW.host, port: GW.port, remark: '扫码枪数据接入网关;数据由上报脚本写入,硬件接入后以真实网关为准', apiKey: GW.apiKey }
  if (found) body.id = found.id
  if (DRY) { console.log('[dry] gateway', JSON.stringify(body)); return found }
  await call('POST', '/api/dc/gateway/save', token, body)
  const cfg2 = await call('GET', '/api/dc/config', token)
  const gw = (cfg2.data.gateways || []).find((g) => g.code === GW.code)
  console.log('网关', gw ? `id=${gw.id} keySet=${gw.keySet}` : '失败')
  return gw
}

async function ensureDevice(token, gw) {
  const cfg = await call('GET', '/api/dc/config', token)
  const dev = (cfg.data.devices || []).find((d) => d.code === DEV.code)
  if (!dev) throw new Error('台账里没有 ' + DEV.code + '(应在 migrate-dc-platform-20261018.sql 种子里)')
  const body = {
    id: dev.id, code: DEV.code, name: DEV.name, type: DEV.type, model: DEV.model, serialNo: DEV.serialNo,
    gatewayId: gw ? gw.id : dev.gatewayId, ip: DEV.ip, port: DEV.port, workshop: DEV.workshop,
    projectCode: DEV.projectCode, scadaDrawn: DEV.scadaDrawn, heartbeatSeconds: DEV.heartbeatSeconds,
    enabled: dev.enabled !== false, remark: DEV.remark,
  }
  if (DRY) { console.log('[dry] device', JSON.stringify(body)); return dev }
  await call('POST', '/api/dc/device/save', token, body)
  const cfg2 = await call('GET', '/api/dc/config', token)
  const out = (cfg2.data.devices || []).find((d) => d.code === DEV.code)
  console.log('设备', JSON.stringify({ id: out.id, progress: out.progress, checks: out.checks, missingTip: out.missingTip }))
  return out
}

async function ensurePoints(token, devId) {
  const list = (await call('GET', '/api/dc/points?deviceId=' + devId, token)).data || []
  for (const p of POINTS) {
    const exist = list.find((x) => x.code === p.code)
    const body = Object.assign({ deviceId: devId }, p)
    if (exist) body.id = exist.id
    if (DRY) { console.log('[dry] point', JSON.stringify(body)); continue }
    await call('POST', '/api/dc/point/save', token, body)
  }
  if (!DRY) console.log('采集点', POINTS.map((p) => p.code).join(' / '))
}

async function ensureRules(token, devId) {
  const list = (await call('GET', '/api/dc/rules?deviceId=' + devId, token)).data || []
  for (const r of RULES) {
    const exist = list.find((x) => x.name === r.name)
    const body = Object.assign({ deviceId: devId, enabled: true }, r)
    if (exist) body.id = exist.id
    if (DRY) { console.log('[dry] rule', JSON.stringify(body)); continue }
    await call('POST', '/api/dc/rule/save', token, body)
  }
  if (!DRY) console.log('规则', RULES.map((r) => r.name).join(' / '))
}

/** 逐条上报;每点一次调用(与真实网关批量上报同一路径) */
async function pushSamples(token) {
  const { scans, rates } = plan()
  console.log(`计划:扫码 ${scans.length} 次 / 读码率 ${rates.length} 条(近 3 天白班)`)
  if (DRY) {
    console.log('  前 3 条扫码:', scans.slice(0, 3).map((s) => iso(s.at) + ' ' + s.code).join(' ; '))
    console.log('  前 3 条读码率:', rates.slice(0, 3).map((r) => iso(r.at) + ' ' + r.v).join(' ; '))
    return
  }
  const key = { 'X-DC-Key': GW.apiKey }
  let ok = 0
  const events = scans.map((s) => ({ at: s.at, code: s.code })).concat(rates.map((r) => ({ at: r.at, rate: r.v })))
  events.sort((a, b) => a.at - b.at)
  for (const e of events) {
    const values = e.code
      ? [{ pointCode: 'SCAN_CODE', text: e.code, at: iso(e.at) }, { pointCode: 'SCAN_COUNT', value: 1, at: iso(e.at) }]
      : [{ pointCode: 'SCAN_RATE', value: e.rate, at: iso(e.at) }]
    await call('POST', '/api/dc/ingest', null, { deviceCode: DEV.code, values }, key)
    ok++
    if (ok % 50 === 0) process.stdout.write(`  ...${ok}/${events.length}\n`)
  }
  console.log(`流水写入 ${ok} 批`)
}

/** --live:每 10 秒一次扫码 + 每 60 秒一条读码率 + 心跳,直到 Ctrl+C(页面实时值演示用) */
async function live() {
  const key = { 'X-DC-Key': GW.apiKey }
  const y = ymd(new Date())
  let seq = 1
  let lastRate = 0
  console.log('LIVE 开始:每 10 秒一次扫码(点 FX-001 看实时值);Ctrl+C 结束')
  await call('POST', '/api/dc/heartbeat', null, { deviceCode: DEV.code }, key)
  for (;;) {
    const now = new Date()
    const mat = MATERIALS[seq % MATERIALS.length]
    const code = `${mat}-${y}-${pad(seq % 999, 3)}`
    const values = [
      { pointCode: 'SCAN_CODE', text: code },
      { pointCode: 'SCAN_COUNT', value: 1 },
    ]
    if (Date.now() - lastRate > 60000) {
      lastRate = Date.now()
      values.push({ pointCode: 'SCAN_RATE', value: Number((96 + Math.random() * 3.6).toFixed(1)) })
    }
    try {
      await call('POST', '/api/dc/ingest', null, { deviceCode: DEV.code, values }, key)
      await call('POST', '/api/dc/heartbeat', null, { deviceCode: DEV.code }, key)
      process.stdout.write(`  ${iso(now)} 扫码 ${code}\n`)
    } catch (e) {
      console.log('  上报失败(继续):', e.message)
    }
    seq++
    await new Promise((r) => setTimeout(r, 10000))
  }
}

;(async () => {
  const login = await call('POST', '/api/auth/login', null, { userName: ACC, password: PWD, factory: FACTORY })
  const token = login.data && login.data.token
  if (!token) throw new Error('登录失败:' + JSON.stringify(login).slice(0, 200))
  console.log('登录 ok factory=' + FACTORY + (DRY ? ' (dry-run)' : ''))

  const gw = await ensureGateway(token)
  const dev = await ensureDevice(token, gw)
  await ensurePoints(token, dev.id)
  await ensureRules(token, dev.id)
  if (LIVE) return live()
  await pushSamples(token)

  if (!DRY) {
    await call('POST', '/api/dc/heartbeat', null, { deviceCode: DEV.code }, { 'X-DC-Key': GW.apiKey })
    const cfg = await call('GET', '/api/dc/config', token)
    const d = (cfg.data.devices || []).find((x) => x.code === DEV.code)
    const mon = await call('GET', '/api/dc/monitor?deviceId=' + d.id, token)
    console.log('\n收尾:', JSON.stringify({
      device: { code: d.code, status: d.status, progress: d.progress, pointCount: d.pointCount, ruleCount: d.ruleCount, missingTip: d.missingTip },
      kpis: cfg.data.kpis,
      monitorPoints: (mon.data.points || []).map((p) => `${p.code}=${p.valueText || p.valueNum}${p.unit || ''}@${p.at}`),
      alarmOpen: mon.data.alarmOpen,
    }, null, 1))
  }
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
