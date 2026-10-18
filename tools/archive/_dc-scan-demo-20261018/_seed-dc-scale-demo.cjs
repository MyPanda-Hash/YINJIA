/**
 * _seed-dc-scale-demo.cjs — 测试电子秤(SIM-SCALE-01)历史流水重铺(2026-10-18)
 *
 * 为什么重铺:老脚本 `_dc-sim/_dc-sim.cjs` 是定周期循环(每 24 秒一条、每次都 55.6),
 * 验收看「报警记录」时 6 条一模一样的 55.6 + 等间隔时间戳,一眼就是机器刷的。
 * 用户口径:「数据的数值和时间要稍微错开」。
 *
 * 本脚本:近 3 天白班,重量 18.4~61.7kg 随机漂移,间隔 40 秒~6 分钟随机,
 * 偶尔一次 >50kg(限值上限)自然触发出报警 —— 值和时间都不重复。
 *
 * ⚠ 前提:先把该设备旧流水/报警/状态日志清掉(archive 目录 README 里有清理 SQL)。
 * 用法: node tools/archive/_dc-scan-demo-20261018/_seed-dc-scale-demo.cjs [--dry-run]
 */
const BASE = process.env.DC_BASE || 'http://127.0.0.1:8090'
const DEV_CODE = 'SIM-SCALE-01'
const POINT = 'W01'
const KEY = { 'X-DC-Key': process.env.DC_SCALE_KEY || 'sim-key-2026' }
const DRY = process.argv.includes('--dry-run')

async function call(method, path, token, body, headers) {
  const res = await fetch(BASE + path, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, headers || {}),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (res.status >= 400) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

/** 近 3 天白班:不规则间隔 + 不规则重量(带缓慢漂移,像真的秤在称) */
function plan() {
  const rand = rng(20261019)
  const today = new Date()
  const out = []
  for (let dayOffset = 2; dayOffset >= 0; dayOffset--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset)
    let at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8, 7, 12)
    const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 16, 52, 0)
    let drift = 22 + rand() * 8
    while (at <= end) {
      if (at <= today) {
        drift += (rand() - 0.5) * 3.4
        if (drift < 18) drift = 18 + rand() * 3
        if (drift > 48) drift = 44 + rand() * 3
        const spikes = rand() < 0.018 // 约 2% 越限(>50kg),制造零散报警
        const v = spikes ? Number((51.2 + rand() * 10.3).toFixed(1)) : Number(drift.toFixed(1))
        out.push({ at: new Date(at), v })
      }
      at = new Date(at.getTime() + (40 + Math.floor(rand() * 320)) * 1000)
    }
  }
  return out
}

;(async () => {
  const login = await call('POST', '/api/auth/login', null, { userName: 'admin', password: '123456', factory: 'YJ' })
  const token = login.data.token
  const rows = plan()
  const spikes = rows.filter((r) => r.v > 50)
  console.log(`计划:${rows.length} 条重量流水,其中越限 ${spikes.length} 条(会触发报警)`)
  if (DRY) {
    console.log('前 5 条:', rows.slice(0, 5).map((r) => iso(r.at) + ' ' + r.v + 'kg').join(' ; '))
    console.log('越限样本:', spikes.map((r) => iso(r.at) + ' ' + r.v).join(' ; '))
    return
  }
  let ok = 0
  for (const r of rows) {
    await call('POST', '/api/dc/ingest', null, { deviceCode: DEV_CODE, values: [{ pointCode: POINT, value: r.v, at: iso(r.at) }] }, KEY)
    if (++ok % 40 === 0) process.stdout.write(`  ...${ok}/${rows.length}\n`)
  }
  // 收尾:设备重新变在线(否则时长统计里它一直是离线)
  await call('POST', '/api/dc/heartbeat', null, { deviceCode: DEV_CODE }, KEY)
  console.log(`写入 ${ok} 条,越限报警 ${spikes.length} 条`)
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
