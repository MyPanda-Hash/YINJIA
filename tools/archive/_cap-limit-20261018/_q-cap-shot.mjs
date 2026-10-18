#!/usr/bin/env node
/**
 * _q-cap-shot.mjs — 桌面「产能对比 · 设置上限」活体验证(2026-10-18)
 *
 * 真登录 → 生产 tab → 产能对比卡点「设置上限」→ 改第一条产线日产能 → 保存 → 图表上限跟着变。
 * ⚠ 会写**正式库产线档案**,脚本结束把原值写回(控制台打印 restore 用原值)。
 * 用法(仓库根): node tools/archive/_cap-limit-20261018/_q-cap-shot.mjs [baseUrl]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9431
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cap-'))
spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)

let cdp = null
try {
  cdp = await attachCdp(PORT)
  const ev = cdp.ev
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable')
  const waitFor = async (expr, ms = 25000) => {
    for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) }
    return false
  }
  const shot = async (name, w, h) => {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
    await sleep(700)
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
    const f = path.join(OUT, name + '.png'); fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
    console.log('   截图', path.basename(f))
    return f
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
  await ev(`(() => { const t=[...document.querySelectorAll('.mod-tab')].find(b=>b.textContent.indexOf('生产')>=0); if (t) t.click(); return 1 })()`)
  await waitFor(`document.querySelectorAll('.scapbars .cap-group').length > 0`, 20000)
  await ev(`(() => { const c=document.querySelector('.scapbars'); if (c) c.scrollIntoView({ block: 'center' }); return 1 })()`)
  await sleep(600)

  const btn = await ev(`(() => { const b=document.querySelector('.scapbars .cap-config'); return b ? b.textContent.trim() : 'NO-BUTTON' })()`)
  console.log('[button]', btn)
  if (btn === 'NO-BUTTON') { console.log('[FAIL] 没有「设置上限」按钮'); process.exit(1) }
  await ev(`(() => { const b=document.querySelector('.scapbars .cap-config'); b.click(); return 1 })()`)
  const dlgOk = await waitFor(`document.querySelectorAll('.el-dialog .el-table__body tr').length > 0`, 15000)
  console.log('[dialog] rows>0 =', dlgOk)
  const rows = await ev(`JSON.stringify([...document.querySelectorAll('.el-dialog .el-table__body tr')].map(tr => ({
    line: (tr.querySelectorAll('td')[0]||{}).textContent.trim(),
    input: (tr.querySelector('input')||{}).value,
  })))`)
  const parsed = JSON.parse(rows || '[]')
  console.log('[dialog] rows=' + parsed.length + ' 首行=' + JSON.stringify(parsed[0]))
  await shot('cap-dialog-1440', 1440, 1000)
  await shot('cap-dialog-375', 375, 1400)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await sleep(500)

  // CAP_NO_SAVE=1:只看弹窗渲染(手机列裁剪/布局),不写正式库
  const NO_SAVE = process.env.CAP_NO_SAVE === '1'
  if (NO_SAVE) {
    console.log('[mode] CAP_NO_SAVE=1:跳过保存')
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 1400, deviceScaleFactor: 1, mobile: true })
    await sleep(600)
    // 手机端不该出现表格横向滚动(列已裁到 产线 + 日产能)
    const of375 = await ev(`(() => {
      const t = document.querySelector('.el-dialog .el-table__body')
      const d = document.documentElement
      return { table: t ? t.scrollWidth > t.clientWidth + 1 : null, page: d.scrollWidth > d.clientWidth + 1 }
    })()`)
    console.log('[375] ' + JSON.stringify(of375))
    const pass = dlgOk && parsed.length > 0 && of375 && of375.table === false
    console.log(pass ? '[PASS] 设置上限弹窗渲染正常 + 手机无横向滚动(未写入)' : '[FAIL] 弹窗未渲染或手机端横向滚动')
    process.exit(pass ? 0 : 2)
  }

  // 改第一条 + 保存(结束后由调用方把原值写回)
  const orig = Number(String(parsed[0]?.input || '').replace(/,/g, '')) || 0
  const next = orig + 600
  await ev(`(() => {
    const tr = document.querySelector('.el-dialog .el-table__body tr')
    const inp = tr.querySelector('input')
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(inp, '${next}')
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    inp.blur()
    return 1
  })()`)
  await sleep(500)
  const seen = await ev(`(() => { const tr=document.querySelector('.el-dialog .el-table__body tr'); return tr.querySelector('input').value })()`)
  console.log('[edit] 输入框=' + seen + ' 原值=' + orig + ' 目标=' + next)
  await ev(`(() => { const btns=[...document.querySelectorAll('.el-dialog .el-dialog__footer button')]
    const b=btns.find(x=>x.textContent.trim()==='保存'); if (b) b.click(); return b ? 'clicked' : 'no-save' })()`)
  const msgOk = await waitFor(`(() => { const m=[...document.querySelectorAll('.el-message')].map(e=>e.textContent.trim()); return m.some(t=>t.indexOf('产能上限已保存')>=0) })()`, 12000)
  console.log('[save] toast=', msgOk)
  await sleep(1200)
  const title = await ev(`(() => {
    const g=[...document.querySelectorAll('.scapbars .cap-group')].find(x=>x.getAttribute('title') && x.getAttribute('title').indexOf('1号车间')===0)
    return g ? g.getAttribute('title') : ''
  })()`)
  console.log('[chart] 首行产线 title=', title)
  await ev(`(() => { const c=document.querySelector('.scapbars'); if (c) c.scrollIntoView({ block: 'center' }); return 1 })()`)
  await shot('cap-after-save-1440', 1440, 1000)

  // 回读接口核对落库(图表 title 是紧凑格式「2.1万」,不能直接比对 20600)
  const lg = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YINJIA-MES' }),
  }).then((r) => r.json())
  const token = lg?.data?.token
  const gl = await fetch(BASE + '/api/dashboard/capacity-lines', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json())
  const saved = (gl?.data || []).find((x) => String(x.line).trim() === String(parsed[0]?.line).trim())
  const capDay = await fetch(BASE + '/api/dashboard/capacity?period=day', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json())
  const capRow = (capDay?.data?.rows || []).find((r) => String(r.name).trim() === String(parsed[0]?.line).trim())
  console.log('[api] 档案日产能=' + saved?.daily + ' 图表上限=' + capRow?.limit + ' 期望=' + next)
  const pass = dlgOk && parsed.length > 0 && msgOk && Number(saved?.daily) === next && Number(capRow?.limit) === next
  console.log(pass ? '[PASS] 设置上限:弹窗打开 + 保存成功 + 档案与图表同步为 ' + next : '[FAIL] 见上面各项')
  console.log('[RESTORE] line=' + JSON.stringify(parsed[0]?.line) + ' daily=' + orig)
  process.exit(pass ? 0 : 2)
} catch (e) {
  console.error('[ERROR]', e)
  process.exit(1)
} finally {
  try { cdp && cdp.close() } catch {}
  spawn('taskkill', ['/F', '/T', '/FI', 'WINDOWTITLE eq about:blank'], { stdio: 'ignore' })
}
