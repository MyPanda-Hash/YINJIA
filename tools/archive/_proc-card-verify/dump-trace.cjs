/** dump-trace.cjs —— 取一张卡的 /procCard/trace 全量(UTF-8 安全,避免 shell 传中文),同时取排产看板的工单追溯做对照 */
const API = 'http://127.0.0.1:8090'
const CARD = process.argv[2] || 'LZK-GD-2026-10-0223-1'
const fs = require('node:fs')
const path = require('node:path')

async function main() {
  const login = await (await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const T = login.data.token
  const post = async (p, body) => {
    const r = await fetch(API + p, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T}` },
      body: Buffer.from(JSON.stringify(body), 'utf8'),
    })
    return { http: r.status, json: await r.json().catch(() => null) }
  }
  const tr = await post('/api/procCard/trace', { 卡号: CARD })
  const data = tr.json?.data || {}
  console.log('=== /procCard/trace.工单追溯 ===')
  console.log(JSON.stringify(data['工单追溯'], null, 2))
  console.log('\n=== 头 ===')
  console.log(JSON.stringify(data['卡'], null, 2))
  const out = path.join(__dirname, 'dump-trace.json')
  fs.writeFileSync(out, JSON.stringify({ card: CARD, trace: data }, null, 2), 'utf8')
  console.log('\n[json] ' + out)
}
main().catch((e) => { console.error(e); process.exit(1) })
