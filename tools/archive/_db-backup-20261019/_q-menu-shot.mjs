/**
 * _q-menu-shot.mjs — 截图取证:「系统管理平台 → 系统功能 → 数据备份」菜单入口确实在。
 * LeftNav 是自绘导航(.nav-group / .nav-modules / .card-item 弹出卡片),不是 el-menu。
 * 用法:node tools/archive/_db-backup-20261019/_q-menu-shot.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9486
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-menu-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
const cdp = await attachCdp(PORT)
await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
const ev = cdp.ev
const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
const shot = async (name) => {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'))
  console.log('   截图', name)
}
try {
  fs.mkdirSync(OUT, { recursive: true })
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: `${BASE}/#/login` })
  await waitFor(`document.querySelectorAll('.login-form input').length >= 2`)
  await ev(`(() => { const ins=[...document.querySelectorAll('.login-form input')]
    const set=(el,v)=>{el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
    set(ins[0],'admin'); set(ins[1],'123456'); return 1 })()`)
  await ev(`(() => { const s=document.querySelector('.login-form .el-select'); (s.querySelector('.el-select__wrapper')||s).click(); return 1 })()`)
  await sleep(1000)
  await ev(`(() => { const it=[...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent)
    const t=it.find(i=>i.textContent.indexOf('YINJIA-MES')>=0 && i.textContent.indexOf('测试')>=0); if(t) t.click(); return 1 })()`)
  await sleep(400)
  await ev(`(() => { const b=document.querySelector('.login-submit'); if(b) b.click(); return 1 })()`)
  await waitFor(`location.hash.indexOf('/login') < 0`)

  // 展开一级「系统管理平台」,再把鼠标移到「系统功能」上弹卡片
  console.log('[展开]', await ev(`(() => { const g=[...document.querySelectorAll('.nav-group')].find(e=>/系统管理平台/.test(e.innerText)); if(!g) return 'no-group'; g.click(); return 'ok' })()`))
  await sleep(900)
  console.log('[模块]', await ev(`(() => [...document.querySelectorAll('.nav-module')].map(e=>e.innerText.replace(/\\s+/g,'')).join('|'))()`))
  console.log('[悬停系统功能]', await ev(`(() => { const m=[...document.querySelectorAll('.nav-module')].find(e=>/系统功能/.test(e.innerText)); if(!m) return 'no-mod'; m.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})); m.click(); return 'ok' })()`))
  await sleep(900)
  const items = await ev(`(() => [...document.querySelectorAll('.card-item')].map(e=>e.innerText.replace(/\\s+/g,'').trim()).filter(Boolean).join(' | '))()`)
  console.log('[系统功能卡片]', items)
  await shot('sys-backup-menu-card-1440.png')

  // 系统管理平台入口页上的「数据备份」按钮
  await ev(`(location.hash='#/sys/console','ok')`)
  await sleep(1800)
  console.log('[系统管理页管理员功能]', await ev(`(() => { const c=[...document.querySelectorAll('.sys-card')].find(e=>/管理员功能/.test(e.innerText)); return c ? c.innerText.replace(/\\s+/g,' ') : 'no-card' })()`))
  await shot('sys-console-entry-1440.png')
} finally {
  cdp.close?.()
  edge.kill()
}
