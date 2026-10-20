/**
 * _q-inspfreq-diag.mjs — 出货检验计划表「检查频率」下拉诊断(2026-10-19)
 *
 * 登录 → 打开 RD_INSP_PLAN 第一张单 → 定位「检查频率」列,打印:
 *   表头清单与该列下标、该列单元格是否 el-select、点开后候选列表。
 *
 * 用法:node tools/archive/_insp-freq-20261019/_q-inspfreq-diag.mjs
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { attachCdp } from '../_cdp.mjs'

const PORT = 9457
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-inspdiag-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
const cdp = await attachCdp(PORT)
await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
const ev = cdp.ev
const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
try {
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

  await ev(`(location.hash='#/panelx/list/RD_INSP_PLAN','ok')`)
  await sleep(4000)
  console.log('列表行数:', await ev(`document.querySelectorAll('.el-table__row').length`))
  await ev(`(() => { const r=document.querySelector('.el-table__row'); if(r) r.click(); return 1 })()`)
  await sleep(3000)

  const diag = await ev(`(() => {
    const ths = [...document.querySelectorAll('th')].map(t => t.textContent.replace(/\\s+/g,' ').trim()).filter(Boolean)
    const idx = ths.findIndex(t => t.indexOf('检查频率') >= 0)
    const table = document.querySelector('table')
    const rows = table ? [...table.querySelectorAll('tbody tr')] : []
    const sample = rows.slice(0, 3).map((tr) => {
      const tds = [...tr.children]
      const td = tds[idx]
      return { tdCount: tds.length, hasSelect: !!(td && td.querySelector('.el-select')), html: td ? td.innerHTML.slice(0, 120) : null }
    })
    return JSON.stringify({ idx, thsCount: ths.length, ths: ths.slice(0, 14), rowCount: rows.length, sample }, null, 1)
  })()`)
  console.log(diag)

  // 点开该列第一行的下拉,读候选
  const clicked = await ev(`(() => {
    const ths = [...document.querySelectorAll('th')]
    const th = ths.find(t => t.textContent.indexOf('检查频率') >= 0)
    if (!th) return 'no-th'
    const idx = [...th.parentElement.children].indexOf(th)
    const rows = [...document.querySelectorAll('table tbody tr')]
    for (const tr of rows) {
      const td = tr.children[idx]
      const w = td && td.querySelector('.el-select__wrapper')
      if (w) { w.click(); return 'clicked@' + idx }
    }
    return 'no-select-cell'
  })()`)
  console.log('点开:', clicked)
  await sleep(900)
  console.log('候选:', await ev(`JSON.stringify([...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent).map(e=>e.textContent.trim()).slice(0,20))`))
  const outDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), 'shots')
  fs.mkdirSync(outDir, { recursive: true })
  const shot = async (name) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.from(r.result.data, 'base64'))
    console.log('   截图', name + '.png')
  }
  await shot('insp-plan-freq-dropdown')
  // 关闭下拉 → 点表头 ⌄ 打开标准库维护
  await ev(`document.body.click(); 1`)
  await sleep(400)
  const libOpened = await ev(`(() => { const p=document.querySelector('.rs-lib-pick'); if(!p) return 'no-pick'; p.click(); return 'ok' })()`)
  await sleep(1500)
  console.log('标准库弹窗:', libOpened, await ev(`(() => { const d=[...document.querySelectorAll('.el-dialog')].find(e=>e.offsetParent); return d ? d.querySelector('.el-dialog__title')?.textContent : '(无)' })()`))
  console.log('弹窗条目数:', await ev(`(() => { const d=[...document.querySelectorAll('.el-dialog')].find(e=>e.offsetParent); return d ? d.querySelectorAll('.slm-row, .el-table__row, li').length : 0 })()`))
  await shot('insp-plan-freq-stdlib')
} finally {
  cdp.close?.()
  edge.kill()
}
