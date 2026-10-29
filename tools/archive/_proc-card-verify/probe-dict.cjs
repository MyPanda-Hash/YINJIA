/** probe-dict.cjs — 为什么 en 下菜单「工序流程追踪卡」还是中文:直接问词典端点 /api/locale/dict */
const API = 'http://127.0.0.1:8090'
async function main() {
  const login = await (await fetch(API + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const T = login.data.token
  for (const [locale, keys] of Object.entries({
    en: ['工序流程追踪卡', '工单日期', '卡片列表', '批次追溯'],
    ja: ['工序流程追踪卡', '工单日期'],
  })) {
    const r = await fetch(API + '/api/locale/dict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${T}` },
      body: Buffer.from(JSON.stringify({ locale, keys }), 'utf8'),
    })
    const j = await r.json().catch(() => null)
    console.log(`\n=== /api/locale/dict locale=${locale} keys=${JSON.stringify(keys)} ===`)
    console.log('HTTP', r.status, 'code', j?.code, 'dict=', JSON.stringify(j?.data?.dict))
  }
  // 库里已有的译名(panel scope)对照
  const fs = require('node:fs')
  fs.writeFileSync(__dirname + '/dict-probe.json', JSON.stringify({ ok: true }, null, 2))
}
main().catch((e) => { console.error(e); process.exit(1) })
