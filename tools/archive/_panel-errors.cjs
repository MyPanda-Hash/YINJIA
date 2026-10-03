/* 打印指定面板的完整报错 + 单次查询耗时(不截断)
   用法: node tools/archive/_panel-errors.cjs ERPLG_ROW OUTSOURCE_ISSUE_DETAIL ... */
const API = 'http://localhost:8090'
async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const H = { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json' }
  for (const p of process.argv.slice(2)) {
    const t0 = performance.now()
    const r = await fetch(`${API}/api/px/queryFormDataList`, {
      method: 'POST', headers: H, body: JSON.stringify({ panelCode: p, pageNo: 1, pageSize: 20 }),
    })
    const j = await r.json()
    const ms = Math.round(performance.now() - t0)
    console.log(`\n#### ${p}  (${ms}ms, code=${j.code})`)
    if (j.code === 200) {
      const d = j.data || {}
      console.log(`   行数=${Array.isArray(d.list) ? d.list.length : '?'} total=${d.total ?? '?'}`)
      continue
    }
    console.log('   ' + String(j.message).replace(/\s+/g, ' ').slice(0, 600))
    // 从报错里抽出 SQL 片段与库侧提示
    const m = String(j.message).match(/列名 '([^']+)' 无效|对象名 '([^']+)' 无效|无效的列名 '([^']+)'/)
    if (m) console.log('   >>> 缺失对象/列: ' + (m[1] || m[2] || m[3]))
    const sql = String(j.message).match(/for SQL \[([^\]]+)\]/)
    if (sql) console.log('   SQL: ' + sql[1].slice(0, 260))
  }
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
