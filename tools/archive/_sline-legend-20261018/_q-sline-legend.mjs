#!/usr/bin/env node
/**
 * _q-sline-legend.mjs — 桌面趋势图图例数字取证(2026-10-18)
 *
 * 用户报「图例显示 0(入库 0 / 出库 0、新增 0 / 已审核 0、送检 0 / 合格 0)」。
 * 口径改为区间合计后,这里逐模块读 .line-legend 文本,并与 /dashboard/stats 的合计对账。
 * 用法(仓库根): node tools/archive/_sline-legend-20261018/_q-sline-legend.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9437
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-sline-'))
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
  const shot = async (name, w, h) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
    await sleep(600)
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
    fs.mkdirSync(OUT, { recursive: true })
    const f = path.join(OUT, name + '.png')
    fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
    console.log('   截图', path.basename(f))
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

  const TABS = [
    { key: 'prod', tab: '生产', expect: '区间新增 / 完工' },
    { key: 'stock', tab: '库存', expect: '出入库趋势' },
    { key: 'sales', tab: '销售', expect: '订单趋势' },
    { key: 'quality', tab: '质量', expect: '送检 / 合格趋势' },
  ]
  let bad = 0
  for (const t of TABS) {
    await ev(`(() => { const b=[...document.querySelectorAll('.mod-tab')].find(x=>x.textContent.indexOf(${JSON.stringify(t.tab)})>=0); if (b) b.click(); return 1 })()`)
    await waitFor(`document.querySelectorAll('.sline').length > 0`, 15000)
    await sleep(900)
    const lines = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.sline')].map((s) => ({
      legend: [...s.querySelectorAll('.line-legend .lg-k')].map((k) => k.textContent.replace(/\\s+/g, ' ').trim()),
      peak: (s.querySelector('.ctx-max') || {}).textContent || '',
    })))`) || '[]')
    console.log('[' + t.key + '] ' + JSON.stringify(lines))
    const ok = lines.length > 0 && lines.every((l) => l.legend.length === 2 && l.legend.some((x) => !/ 0$/.test(x)))
    if (!ok) bad++
    if (t.key === 'stock' || t.key === 'quality') {
      await ev(`(() => { const s=document.querySelector('.sline'); if (s) s.scrollIntoView({ block: 'center' }); return 1 })()`)
      await shot('legend-' + t.key + '-1440', 1440, 1000)
    }
  }
  console.log(bad === 0 ? '[PASS] 各趋势图图例数字非全 0(区间合计)' : `[FAIL] ${bad} 个模块图例仍显示 0`)
  process.exit(bad === 0 ? 0 : 2)
} catch (e) {
  console.error('[ERROR]', e)
  process.exit(1)
} finally {
  try { cdp && cdp.close() } catch {}
  spawn('taskkill', ['/F', '/T', '/FI', 'WINDOWTITLE eq about:blank'], { stdio: 'ignore' })
}
