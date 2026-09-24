// _aspmis-probe/fetch-pages.cjs — 生产站(www.aspmis.com:160)只读抓页工具
// 只发登录 POST + GET 页面,不做任何业务写操作。输出到同目录 html/ 子目录。
const fs = require('node:fs')
const path = require('node:path')
const BASE = 'https://www.aspmis.com:160'
const OUT = path.join(__dirname, 'html')
fs.mkdirSync(OUT, { recursive: true })

// 口令不入库: 用法 $env:ASP_PASS='<口令>'; node fetch-pages.cjs
async function login(lang = '简体') {
  const pass = process.env.ASP_PASS
  if (!pass) { throw new Error('缺少环境变量 ASP_PASS(口令不落盘)') }
  const body = new URLSearchParams({ LANGUAGE: lang, companyid: process.env.ASP_COMPANY || '0', username: process.env.ASP_USER || 'Admin', password: pass, maxrecord: '' }).toString()
  const r = await fetch(BASE + '/admin/login/sys', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'Mozilla/5.0' },
    body, redirect: 'manual',
  })
  const txt = await r.text()
  const cookies = (r.headers.getSetCookie() || []).map((c) => c.split(';')[0]).join('; ')
  return { txt, cookies }
}

async function get(cookies, urlPath) {
  const r = await fetch(BASE + urlPath, { headers: { cookie: cookies, 'user-agent': 'Mozilla/5.0' }, redirect: 'manual' })
  const t = await r.text()
  return { status: r.status, loc: r.headers.get('location'), t }
}

async function main() {
  const which = process.argv[2] || 'all'
  const { txt, cookies } = await login()
  console.log('login:', txt.trim(), '\ncookies:', cookies.split(';').length, '个')
  fs.writeFileSync(path.join(__dirname, 'cookies-zh.txt'), cookies)

  const targets = which === 'all'
    ? ['/admin', '/admin/welcome', '/BasCust/List', '/SysLog/List']
    : [which]
  for (const p of targets) {
    const { status, loc, t } = await get(cookies, p)
    const name = p.replace(/[\/]/g, '_') + '.html'
    fs.writeFileSync(path.join(OUT, name), t)
    console.log(`GET ${p} -> ${status}${loc ? ' loc=' + loc : ''} len=${t.length} => html/${name}`)
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
