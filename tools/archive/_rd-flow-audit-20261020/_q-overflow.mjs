/**
 * 诊断:375 视口下哪些元素超出页面宽度(定位横向滚动来源)。
 * 用法: node _q-overflow.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { attachCdp } from '../_cdp.mjs'

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const HASH = process.argv[3] || '#/rd/projectFlow'
const PORT = 9475
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ovf-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
const cdp = await attachCdp(PORT)
await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
const ev = cdp.ev
const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
try {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true })
  await cdp.send('Page.navigate', { url: `${BASE}/#/login` })
  await waitFor(`document.querySelectorAll('.login-form input').length >= 2`)
  await ev(`(() => { const ins=[...document.querySelectorAll('.login-form input')]
    const set=(el,v)=>{el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
    set(ins[0],'admin'); set(ins[1],'123456'); return 1 })()`)
  await sleep(600)
  await ev(`(() => { const b=document.querySelector('.login-submit'); if(b) b.click(); return 1 })()`)
  await waitFor(`location.hash.indexOf('/login') < 0`)
  await ev(`(location.hash='${HASH}','ok')`)
  await sleep(3500)
  console.log(await ev(`(() => {
    const vw = document.documentElement.clientWidth
    const bad = []
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.right > vw + 1 && r.width > 0) bad.push(el.tagName.toLowerCase() + '.' + (el.className && el.className.baseVal === undefined ? String(el.className).split(' ').slice(0,2).join('.') : '') + ' right=' + Math.round(r.right) + ' w=' + Math.round(r.width))
      if (bad.length > 12) break
    }
    return 'vw=' + vw + ' scrollW=' + document.documentElement.scrollWidth + '\\n' + bad.join('\\n')
  })()`))
} finally {
  cdp.close?.(); edge.kill()
}
