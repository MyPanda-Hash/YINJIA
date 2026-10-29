/**
 * _q-login-diag.mjs —— 诊断登录页按钮/提交方式
 */
import { createRequire } from 'node:module'
const require = createRequire('C:/INCER/YINJIA-MES/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const s = await launch({ port: 9415 })
await s.navigate(BASE + '/#/login')
await sleep(3000)
const d = await s.evaluate(`(() => {
  const ins = [...document.querySelectorAll('input')]
  const btns = [...document.querySelectorAll('button, .el-button, [role=button]')]
  return {
    inputs: ins.map(i => ({ type: i.type, ph: i.placeholder, cls: i.className, vis: i.offsetParent !== null })),
    buttons: btns.map(b => ({ tag: b.tagName, txt: (b.textContent||'').trim().slice(0,20), cls: String(b.className).slice(0,60), type: b.type, vis: b.offsetParent !== null })),
    forms: document.querySelectorAll('form').length,
  }
})()`)
console.log(JSON.stringify(d, null, 2))
await s.close?.()
process.exit(0)
