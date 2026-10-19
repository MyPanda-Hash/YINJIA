/**
 * _q-backup-i18n.mjs — 多语言检查(AGENTS 强制):数据备份面板切到 English 后不能出现中文。
 * 同时截一张「系统管理平台 → 系统功能」展开的侧边栏(证明「数据备份」菜单入口在)。
 * 用法:node tools/archive/_db-backup-20261019/_q-backup-i18n.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9485
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-i18n-'))
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
    const t=it.find(i=>i.textContent.indexOf('YINJIA-MES')>=0 && i.textContent.indexOf('测试')>=0); if(!t) return 'no'; t.click(); return 'ok' })()`)
  await sleep(400)
  await ev(`(() => { const b=document.querySelector('.login-submit'); if(b) b.click(); return 1 })()`)
  await waitFor(`location.hash.indexOf('/login') < 0`)

  // ① 中文:展开侧边栏「系统管理平台 → 系统功能」,看「数据备份」入口
  await ev(`(location.hash='#/sys/backup','ok')`)
  await sleep(2000)
  await ev(`(() => { const ns=[...document.querySelectorAll('.el-menu .el-sub-menu__title, .el-menu .el-menu-item')]
    for (const n of ns) if (/系统管理平台/.test(n.innerText)) { n.click(); break } return 1 })()`)
  await sleep(600)
  await ev(`(() => { const ns=[...document.querySelectorAll('.el-menu .el-sub-menu__title, .el-menu .el-menu-item')]
    for (const n of ns) if (/系统功能/.test(n.innerText)) { n.click(); break } return 1 })()`)
  await sleep(800)
  const menu = await ev(`(() => [...document.querySelectorAll('.el-menu .el-menu-item')].map(e=>e.innerText.replace(/\\s+/g,'').trim()).filter(t=>t).join(' | '))()`)
  console.log('[侧边栏可见菜单]', menu)
  await shot('sys-backup-menu-zh.png')

  // ② 切英文:面板上不允许出现中文
  await ev(`(localStorage.setItem('mes_locale','en'),'ok')`)
  await ev(`(location.reload(),'ok')`)
  await waitFor(`(document.body.innerText||'').length > 100`, 30000)
  await sleep(2500)
  await ev(`(location.hash='#/sys/backup','ok')`)
  await sleep(2500)
  const txt = await ev(`(document.querySelector('.bk-page')||document.body).innerText.replace(/\\s+/g,' ').slice(0,700)`)
  const cjk = (txt || '').match(/[\u4e00-\u9fa5]/g) || []
  console.log('[英文界面文案]', txt)
  console.log('[英文界面残留中文个数]', cjk.length, cjk.slice(0, 20).join(''))
  const menuEn = await ev(`(() => [...document.querySelectorAll('.el-menu .el-menu-item')].map(e=>e.innerText.replace(/\\s+/g,'').trim()).filter(t=>t).join(' | '))()`)
  console.log('[英文侧边栏]', menuEn)
  await shot('sys-backup-en-1440.png')
} finally {
  cdp.close?.()
  edge.kill()
}
