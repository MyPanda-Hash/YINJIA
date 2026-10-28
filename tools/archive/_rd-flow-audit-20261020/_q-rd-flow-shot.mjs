/**
 * _q-rd-flow-shot.mjs — 「项目流程管控」活体取证(2026-10-20)
 *
 * 登录 → 进 /#/rd/projectFlow → 截图(1440 与 375 两档) → dump 首页表格文案 + 展开首行看 10 步时间轴。
 * 用法:node tools/archive/_rd-flow-audit-20261020/_q-rd-flow-shot.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9473
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rdflow-'))
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
  console.log('[shot]', name)
}
try {
  fs.mkdirSync(OUT, { recursive: true })
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: `${BASE}/#/login` })
  await waitFor(`document.querySelectorAll('.login-form input').length >= 2`)
  await ev(`(() => { const ins=[...document.querySelectorAll('.login-form input')]
    const set=(el,v)=>{el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
    set(ins[0],'admin'); set(ins[1],'123456'); return 1 })()`)
  await ev(`(() => { const s=document.querySelector('.login-form .el-select'); if(s) s.click(); return 1 })()`)
  await sleep(1200)
  const opts = await ev(`[...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent).map(e=>e.textContent.trim())`)
  console.log('[账套选项]', opts)
  // 切到测试账套(8 条在办立项,取证比正式账套的 2 条更有说服力)
  const picked = await ev(`(() => { const it=[...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent)
    const t=it.find(i=>i.textContent.indexOf('测试')>=0); if(!t) return 'no-test-option'; t.click(); return t.textContent.trim() })()`)
  console.log('[选中账套]', picked)
  await sleep(600)
  await ev(`(() => { const b=document.querySelector('.login-submit'); if(b) b.click(); return 1 })()`)
  await waitFor(`location.hash.indexOf('/login') < 0`)
  await sleep(800)

  await ev(`(location.hash='#/rd/projectFlow','ok')`)
  await sleep(3500)
  console.log('[标题]', await ev(`(document.querySelector('.pf-title')||{}).textContent||'(无 .pf-title)'`))
  console.log('[KPI]', await ev(`[...document.querySelectorAll('.pf-kpi')].map(e=>e.innerText.replace(/\\s+/g,' ')).join(' | ')`))
  const rowCount = await ev(`document.querySelectorAll('.pf-table .el-table__body tr.el-table__row').length`)
  console.log('[行数]', rowCount)
  await shot('rd-flow-1440.png')

  // 展开第一行,截图时间轴
  await ev(`(() => { const c=document.querySelector('.pf-table .el-table__expand-icon'); if(c){c.click(); return 'ok'} return 'no-expand' })()`)
  await sleep(900)
  console.log('[展开行文案]', await ev(`(() => { const e=document.querySelector('.pf-flow'); return e? e.innerText.replace(/\\s+/g,' ').slice(0,700) : '(无 .pf-flow)' })()`))
  await shot('rd-flow-expand-1440.png')

  // 375 窄屏(检查无横向滚动 / 裁切)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true })
  await sleep(1200)
  console.log('[375 横向滚动]', await ev(`(document.documentElement.scrollWidth > document.documentElement.clientWidth ? 'HAS-HSCROLL ' + document.documentElement.scrollWidth + '>' + document.documentElement.clientWidth : 'none')`))
  console.log('[375 谁在撑]', await ev(`(() => {
    const vw = document.documentElement.clientWidth
    const out = []
    for (const sel of ['.pf-page', '.pf-card', '.t-right', '.el-table', '.el-table__body-wrapper', 'body']) {
      const el = document.querySelector(sel)
      if (!el) continue
      const r = el.getBoundingClientRect()
      out.push(sel + ' right=' + Math.round(r.right) + ' w=' + Math.round(r.width) + ' scrollW=' + el.scrollWidth)
    }
    return 'vw=' + vw + ' | ' + out.join(' | ')
  })()`))
  await shot('rd-flow-375.png')
} finally {
  try { edge.kill() } catch {}
}
