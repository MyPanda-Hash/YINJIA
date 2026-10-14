/** A4 收尾核验:① RD_MOLD_PROC 面板是否真有「产品编号」表头键 + 四个目标格 ② 用 admin 与 cp 各跑一次 specByProduct */
const BASE = 'http://127.0.0.1:8090'
const CODE = 'A4TEST01'
const log = []
const p = (s) => { log.push(String(s)); console.log(s) }

async function login(u, pw) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: u, password: pw, factory: 'YJ_TEST' }) })
  const j = await r.json()
  if (j.code !== 200) throw new Error('login ' + u + ' failed: ' + JSON.stringify(j))
  return j.data.token
}
async function get(url, token) {
  const r = await fetch(BASE + url, { headers: { Authorization: 'Bearer ' + token } })
  const t = await r.text()
  let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j, text: t }
}

;(async () => {
  const admin = await login('admin', '123456')
  const cfg = await get('/api/px/getPanelConfig?panelCode=RD_MOLD_PROC', admin)
  const d = cfg.json && cfg.json.data
  p('=== getPanelConfig RD_MOLD_PROC · HTTP ' + cfg.status + ' · data keys = ' + (d ? Object.keys(d).join(',') : '(null)'))
  const buf = JSON.stringify(d)
  for (const k of ['产品编号', '炭棒尺寸', '跌落强度', '抗压强度', '压降']) {
    p('  含「' + k + '」? ' + (buf.includes(k) ? '✅' : '❌'))
  }

  for (const [u, pw] of [['admin', '123456'], ['cp', '123456']]) {
    const tk = await login(u, pw)
    const r = await get('/api/px/specByProduct?code=' + CODE, tk)
    p('')
    p('=== specByProduct as ' + u + ' · HTTP ' + r.status + ' ===')
    p(JSON.stringify(r.json))
  }
  const fs = require('fs'); fs.writeFileSync(__dirname + '/_a4-final.out.txt', log.join('\n'), 'utf8')
})().catch((e) => { console.error('FAIL', e); const fs = require('fs'); fs.writeFileSync(__dirname + '/_a4-final.out.txt', log.concat('FAIL ' + e.stack).join('\n'), 'utf8'); process.exit(1) })
