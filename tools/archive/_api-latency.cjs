/* 接口延迟体检:登录后逐个面板计时 getPanelConfig + queryFormDataList
   用法: node tools/archive/_api-latency.cjs <面板码清单文件> [每面板样例数]
   清单文件: 每行一个 panel_code(由 sqlcmd 导出,见文件头注释)
   目的:把"系统流畅性"落到可复现数字 —— p50/p95/max、最慢面板、失败面板。 */
const fs = require('node:fs')
const API = 'http://localhost:8090'

const listFile = process.argv[2]
const rounds = Number(process.argv[3] || 1)

async function main() {
  const api = await fetch(`${API}/api/base/factory/list`).then((r) => r.json())
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const token = login.data?.token
  if (!token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 200))
  console.log(`[login] ok factories=${api.data?.length}`)

  const panels = fs.readFileSync(listFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  console.log(`[panels] ${panels.length} 个`)

  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const cfg = [], qry = [], fail = []

  for (const p of panels) {
    for (let i = 0; i < rounds; i++) {
      let t0 = performance.now()
      try {
        const r = await fetch(`${API}/api/px/getPanelConfig?panelCode=${encodeURIComponent(p)}`, { headers: H })
        const j = await r.json()
        cfg.push({ p, ms: performance.now() - t0 })
        if (j.code !== 200) fail.push(`CFG ${p}: ${j.code} ${String(j.message).slice(0, 60)}`)
      } catch (e) { fail.push(`CFG ${p}: ${e.message}`) }

      t0 = performance.now()
      try {
        const r = await fetch(`${API}/api/px/queryFormDataList`, {
          method: 'POST', headers: H,
          body: JSON.stringify({ panelCode: p, pageNo: 1, pageSize: 20 }),
        })
        const j = await r.json()
        qry.push({ p, ms: performance.now() - t0 })
        if (j.code !== 200) fail.push(`QRY ${p}: ${j.code} ${String(j.message).slice(0, 60)}`)
      } catch (e) { fail.push(`QRY ${p}: ${e.message}`) }
    }
  }

  const stat = (arr) => {
    const v = arr.map((x) => x.ms).sort((a, b) => a - b)
    const q = (n) => v[Math.min(v.length - 1, Math.floor(v.length * n))] || 0
    return { n: v.length, p50: q(0.5), p90: q(0.9), p95: q(0.95), max: v[v.length - 1] || 0, sum: v.reduce((a, b) => a + b, 0) }
  }
  const fmt = (s) => `n=${s.n} p50=${s.p50.toFixed(0)}ms p90=${s.p90.toFixed(0)}ms p95=${s.p95.toFixed(0)}ms max=${s.max.toFixed(0)}ms 合计=${(s.sum / 1000).toFixed(1)}s`
  console.log('\n=== getPanelConfig ===  ' + fmt(stat(cfg)))
  console.log('=== queryFormDataList ===  ' + fmt(stat(qry)))

  const top = (arr, k) => arr.slice().sort((a, b) => b.ms - a.ms).slice(0, k)
  console.log('\n最慢 getPanelConfig TOP 12:')
  for (const x of top(cfg, 12)) console.log(`  ${x.p.padEnd(26)} ${x.ms.toFixed(0).padStart(6)}ms`)
  console.log('\n最慢 queryFormDataList TOP 15:')
  for (const x of top(qry, 15)) console.log(`  ${x.p.padEnd(26)} ${x.ms.toFixed(0).padStart(6)}ms`)

  if (fail.length) { console.log(`\n失败 ${fail.length} 项:`); for (const f of fail.slice(0, 20)) console.log('  ' + f) }
  else console.log('\n失败 0 项')
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
