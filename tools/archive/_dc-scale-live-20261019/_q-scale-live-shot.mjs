/**
 * _q-scale-live-shot.mjs — 真实电子秤数据进 MES 的活体取证(2026-10-19)
 *
 * 打开「数据监控」→ 选「电子秤」→ 截图,并 dump 采集点实时值/状态与设备在线态。
 * 用法:node tools/archive/_dc-scale-live-20261019/_q-scale-live-shot.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9471
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-scale-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
const cdp = await attachCdp(PORT)
await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
const ev = cdp.ev
const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
try {
  fs.mkdirSync(OUT, { recursive: true })
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: `${BASE}/#/login` })
  await waitFor(`document.querySelectorAll('.login-form input').length >= 2`)
  await ev(`(() => { const ins=[...document.querySelectorAll('.login-form input')]
    const set=(el,v)=>{el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
    set(ins[0],'admin'); set(ins[1],'123456'); return 1 })()`)
  await ev(`(() => { const s=document.querySelector('.login-form .el-select'); if(s) s.click(); return 1 })()`)
  await sleep(700)
  await ev(`(() => { const it=[...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent)
    const t=it.find(i=>i.textContent.indexOf('YINJIA-MES')>=0 && i.textContent.indexOf('测试')<0); if(t) t.click(); return 1 })()`)
  await sleep(400)
  await ev(`(() => { const b=document.querySelector('.login-submit'); if(b) b.click(); return 1 })()`)
  await waitFor(`location.hash.indexOf('/login') < 0`)

  await ev(`(location.hash='#/dc/monitor','ok')`)
  await sleep(3500)
  const clicked = await ev(`(() => { const d=[...document.querySelectorAll('.dc-dev')].find(e=>/电子秤/.test(e.innerText) && !/测试/.test(e.innerText)); if(!d) return 'no-dev'; d.click(); return 'ok' })()`)
  await sleep(2500)
  console.log('[选中电子秤]', clicked)
  console.log('[页面文案]', await ev(`(document.querySelector('.dc-main')||document.body).innerText.replace(/\\s+/g,' ').slice(0,400)`))
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(OUT, 'dc-monitor-scale-live.png'), Buffer.from(r.result.data, 'base64'))
  console.log('   截图 dc-monitor-scale-live.png')
} finally {
  cdp.close?.()
  edge.kill()
}
