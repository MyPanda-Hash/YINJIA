/**
 * _q-api-timing.mjs —— 接口响应耗时扫查(只读,2026-10-16「优化系统响应速度」专项)
 *
 * 为什么要它:用户口径「优化系统响应速度,看看有没有可以优化的点,但是不要破坏系统正常使用」。
 * 先量再改 —— 把桌面/面板/接口的**墙钟耗时 + 响应体大小**排个序,只动真有账可算的那几处。
 *
 * 做法:每个端点跑 3 次取中位数(第一次含冷启动/计划缓存,单独标出),并记录响应体字节数
 * (payload 也是"响应速度"的一部分:几 MB 的 JSON 在浏览器端要解析、要渲染)。
 *
 * 用法: node tools/archive/_perf-sweep-20261016/_q-api-timing.mjs [baseUrl]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const RUNS = Number(process.argv[3] || 3)

const post = async (p, b, token) => {
  const t0 = performance.now()
  const res = await fetch(BASE + '/api' + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(b || {}),
  })
  const text = await res.text()
  return { ms: performance.now() - t0, bytes: Buffer.byteLength(text), text }
}
const get = async (p, token) => {
  const t0 = performance.now()
  const res = await fetch(BASE + '/api' + p, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  const text = await res.text()
  return { ms: performance.now() - t0, bytes: Buffer.byteLength(text), text }
}

const lg = JSON.parse((await post('/auth/login', { userName: 'admin', password: '123456' })).text)
if (lg.code !== 200) { console.log('登录失败', JSON.stringify(lg).slice(0, 120)); process.exit(1) }
const T = lg.data.token
const kb = (n) => (n / 1024).toFixed(1) + ' KB'

/** 面板清单:按数据量挑代表(大单据表 / 宽档案 / flat 报表 / 研发文书) */
const PANELS = ['SO_ORDER', 'PURCHASE_IN', 'QC_INSP', 'QC_RECV', 'INV', 'STOCK_LEDGER', 'STOCK_DETAIL', 'RD_PROD_INFO', 'QC_ASM_INSP', 'DISPATCH']

const rows = []
async function bench(name, fn) {
  const times = []
  let bytes = 0
  for (let i = 0; i < RUNS; i++) {
    const r = await fn()
    times.push(r.ms)
    bytes = r.bytes
  }
  const sorted = times.slice().sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)]
  rows.push({ name, first: times[0], med, max: Math.max(...times), bytes })
  process.stdout.write(`  ${name.padEnd(46)} 中位 ${med.toFixed(0).padStart(6)} ms  首次 ${times[0].toFixed(0).padStart(6)} ms  ${kb(bytes).padStart(10)}\n`)
}

console.log(`== 接口耗时扫查 @ ${BASE}(每项 ${RUNS} 次,取中位)==\n`)
console.log('[壳与桌面]')
await bench('GET /sys/menu/tree', () => get('/sys/menu/tree', T))
await bench('GET /dashboard/stats (近30天)', () => get('/dashboard/stats', T))
await bench('GET /dashboard/flow', () => get('/dashboard/flow', T))
await bench('GET /dashboard/capacity?day', () => get('/dashboard/capacity?period=day', T))
await bench('GET /dashboard/rd', () => get('/dashboard/rd', T))
await bench('GET /sys/role/2/panels(权限矩阵)', () => get('/sys/role/2/panels', T))

console.log('\n[面板配置]')
for (const p of PANELS.slice(0, 5)) await bench(`GET /px/getPanelConfig ${p}`, () => get(`/px/getPanelConfig?panelCode=${p}`, T))

console.log('\n[面板取数(列表页首屏)]')
for (const p of PANELS) {
  await bench(`POST /px/queryFormDataList ${p}`, () => post('/px/queryFormDataList', { panelCode: p, condition: {}, pageNo: 1, pageSize: 50 }, T))
}

console.log('\n== 按中位耗时排序(只列 > 100ms 的)==')
rows.filter((r) => r.med > 100).sort((a, b) => b.med - a.med)
  .forEach((r) => console.log(`  ${r.med.toFixed(0).padStart(6)} ms  ${kb(r.bytes).padStart(10)}  ${r.name}`))
console.log('\n== 按响应体大小排序(前 5,payload 也是响应速度)==')
rows.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 5)
  .forEach((r) => console.log(`  ${kb(r.bytes).padStart(10)}  ${r.med.toFixed(0).padStart(6)} ms  ${r.name}`))
