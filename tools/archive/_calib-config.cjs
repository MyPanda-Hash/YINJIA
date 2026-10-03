/* 标定面板配置 JSON 里"列表可见列数"与"页大小"的正确路径
   真值锚点(浏览器实测):SO_ORDER 列表 16 列 / INV 56 列 / PURCHASE_IN 24 列
   用法: node tools/archive/_calib-config.cjs SO_ORDER INV PURCHASE_IN */
const API = 'http://localhost:8090'
const TRUTH = { SO_ORDER: 16, INV: 56, PURCHASE_IN: 24 }

function walk(o, path, acc, depth = 0) {
  if (depth > 5 || o === null) return
  if (Array.isArray(o)) {
    if (o.length && typeof o[0] === 'object' && o[0] !== null) {
      const k = Object.keys(o[0])
      if (k.includes('prop') || k.includes('field') || k.includes('label')) acc.push({ path: path + '[]', n: o.length, keys: k.slice(0, 8).join(',') })
    }
    o.slice(0, 1).forEach((v) => walk(v, path + '[]', acc, depth + 1))
    return
  }
  if (typeof o === 'object') {
    for (const [key, v] of Object.entries(o)) walk(v, path ? path + '.' + key : key, acc, depth + 1)
  }
}

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const H = { Authorization: `Bearer ${login.data.token}` }
  for (const p of process.argv.slice(2)) {
    const j = await fetch(`${API}/api/px/getPanelConfig?panelCode=${encodeURIComponent(p)}`, { headers: H }).then((r) => r.json())
    const d = j.data || {}
    console.log(`\n#### ${p}  顶层键: ${Object.keys(d).join(', ')}`)
    const acc = []
    walk(d, '', acc)
    console.log('   含列数组的候选路径(真值应为 ' + TRUTH[p] + '):')
    for (const a of acc.slice(0, 14)) console.log(`     ${a.path.padEnd(42)} n=${String(a.n).padStart(4)}  keys=${a.keys}`)
    // 页大小候选
    const ps = JSON.stringify(d).match(/"pageSize"\s*:\s*(\d+)/g)
    console.log('   pageSize 出现: ' + (ps ? ps.join(' ') : '无'))
  }
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
