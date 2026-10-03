/* 看面板配置里的 pageSize 到底是不是 yj_panel.page_size 的来源
   用法: node tools/archive/_pagesize-probe.cjs INV KHDA SO_ORDER BOM OP_TIME */
const API = 'http://localhost:8090'
async function main() {
  const l = await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const H = { Authorization: 'Bearer ' + l.data.token }
  for (const p of process.argv.slice(2)) {
    const j = await fetch(API + '/api/px/getPanelConfig?panelCode=' + p, { headers: H }).then((r) => r.json())
    const d = j.data || {}
    const found = []
    const walk = (o, path) => {
      if (o === null || typeof o !== 'object') return
      for (const [k, v] of Object.entries(o)) {
        if (/pageSize/i.test(k)) found.push(path + '.' + k + '=' + v)
        else if (typeof v === 'object') walk(v, path + '.' + k)
      }
    }
    walk(d, '')
    console.log(`  ${p.padEnd(10)} ${found.length ? found.join('  ') : '配置内无 pageSize'}`)
  }
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(1) })
