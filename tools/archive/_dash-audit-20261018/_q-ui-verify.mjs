#!/usr/bin/env node
/**
 * _q-ui-verify.mjs — 看板口径统一后的活体界面取证(2026-10-18)
 *  · 库存/销售/质量 三张趋势卡图例数字(按单据数 / 已审核统一 / 送检数量标题)
 *  · 流程管控 → 生产工单节点是否出现「已结案」
 * 用法(仓库根): node tools/archive/_dash-audit-20261018/_q-ui-verify.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9441
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dash-'))
spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)

let cdp = null
try {
  cdp = await attachCdp(PORT)
  const ev = cdp.ev
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
  const waitFor = async (expr, ms = 25000) => {
    for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) }
    return false
  }
  const shot = async (name) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'))
    console.log('   截图', name + '.png')
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: BASE + '/#/login' })
  await waitFor(`document.querySelectorAll('.login-form input').length >= 2`)
  await ev(`(() => { const i=[...document.querySelectorAll('.login-form input')]
    const set=(e,v)=>{e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}
    set(i[0],'admin'); set(i[1],'123456'); return 1 })()`)
  await ev(`(() => { const s=document.querySelector('.login-form .el-select'); if (s) s.click(); return 1 })()`)
  await sleep(700)
  await ev(`(() => { const t=[...document.querySelectorAll('.el-select-dropdown__item')].find(e=>e.textContent.trim()==='YINJIA-MES'); if (t) t.click(); return 1 })()`)
  await sleep(400)
  await ev(`(() => { const b=document.querySelector('.login-submit'); if (b) b.click(); return 1 })()`)
  if (!await waitFor(`location.hash.indexOf('/login') < 0`, 30000)) { console.log('[FAIL] 登录失败'); process.exit(1) }
  await ev(`(location.hash='#/dashboard','ok')`)
  await waitFor(`document.querySelectorAll('.mod-tab').length > 0`)
  await sleep(1200)

  const clickTab = async (name) => {
    await ev(`(() => { const b=[...document.querySelectorAll('.mod-tab')].find(x=>x.textContent.indexOf(${JSON.stringify(name)})>=0); if (b) b.click(); return 1 })()`)
    await sleep(1500)
  }
  const legendOf = async () => JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.sline .line-legend .lg-k')].map((k)=>k.textContent.replace(/\\s+/g,' ').trim()))`) || '[]')

  await clickTab('库存'); console.log('[stock] 图例', await legendOf()); await shot('verify-stock')
  await clickTab('销售'); console.log('[sales] 图例', await legendOf())
  await clickTab('质量')
  const qTitle = await ev(`(() => { const t=[...document.querySelectorAll('.kpi-title')].map(e=>e.textContent.trim()); return t[0] || '' })()`)
  console.log('[quality] 首张 KPI 标题=' + qTitle)
  await shot('verify-quality')

  await clickTab('流程管控')
  await sleep(1500)
  const woText = await ev(`(() => { const n=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&e.textContent.trim()==='生产工单'); if(!n) return ''; const card=n.closest('button,section,div'); return card?card.textContent.replace(/\\s+/g,' ').trim().slice(0,220):'' })()`)
  console.log('[flow] 生产工单卡文本=', woText)
  await shot('verify-flow')
} catch (e) {
  console.error('[ERROR]', e)
  process.exit(1)
} finally {
  try { cdp && cdp.close() } catch {}
  spawn('taskkill', ['/F', '/T', '/FI', 'WINDOWTITLE eq about:blank'], { stdio: 'ignore' })
}
