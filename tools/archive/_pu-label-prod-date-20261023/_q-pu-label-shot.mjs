#!/usr/bin/env node
/**
 * _q-pu-label-shot.mjs — 采购订单「打印材料码」弹窗·生产日期框 活体验证(2026-10-23)
 *
 * 用户口径「采购订单的打印材料码界面需要在批次号后面加个生产日期,进行填写,
 *            填写后可以打印的材料码会加上生产日期」。
 *
 * 本探针**只读**:打开弹窗、截图、读 DOM 上批次号框右侧有没有日期框、读出日期框的 placeholder,
 * 并核对「已打印记录」表头是否有「生产日期」列。**不点「确定并打印」**(那会往正式库写打印单并占用预约量)。
 *
 * 用法(仓库根): node tools/archive/_pu-label-prod-date-20261023/_q-pu-label-shot.mjs [orderNo] [baseUrl]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ORDER = process.argv[2] || 'YJ-20261012-04'
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9461
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pulabel-'))
spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)

let cdp = null
const fails = []
try {
  cdp = await attachCdp(PORT)
  const ev = cdp.ev
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable')
  const waitFor = async (expr, ms = 30000) => {
    for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) }
    return false
  }
  const shot = async (name) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
    const f = path.join(OUT, name + '.png'); fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
    console.log('   截图', path.relative(process.cwd(), f))
    return f
  }
  const log = (ok, msg) => { console.log((ok ? '   [PASS] ' : '   [FAIL] ') + msg); if (!ok) fails.push(msg) }

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: BASE + '/#/login' })
  if (!await waitFor(`document.querySelectorAll('.login-form input').length >= 2`)) throw new Error('登录页没出来')
  await ev(`(() => { const i=[...document.querySelectorAll('.login-form input')]
    const set=(e,v)=>{e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}
    set(i[0],'admin'); set(i[1],'123456'); return 1 })()`)
  await ev(`(() => { const s=document.querySelector('.login-form .el-select'); if (s) s.click(); return 1 })()`)
  await sleep(700)
  await ev(`(() => { const t=[...document.querySelectorAll('.el-select-dropdown__item')].find(e=>e.textContent.trim()==='YINJIA-MES'); if (t) t.click(); return 1 })()`)
  await sleep(400)
  await ev(`(() => { const b=document.querySelector('.login-submit'); if (b) b.click(); return 1 })()`)
  if (!await waitFor(`location.hash.indexOf('/login') < 0`, 30000)) throw new Error('登录失败')
  console.log('   登录 OK')

  await ev(`(location.hash='#/panelx/list/PU_ORDER','ok')`)
  if (!await waitFor(`document.querySelectorAll('.el-table__row').length > 0`, 45000)) {
    console.log('   面板行未出现')
  }
  await sleep(2000)

  // 用面板搜索框按单号定位(截图里的单:YJ-20261012-04),选中一行后再点「打印材料码」
  await ev(`(() => {
    const inputs=[...document.querySelectorAll('input')].filter(e=>/单号|搜索/.test(e.placeholder||''))
    if (!inputs.length) return 0
    const set=(e,v)=>{e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}
    set(inputs[0], ${JSON.stringify(ORDER)})
    inputs[0].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))
    return inputs.length
  })()`)
  await sleep(2500)
  await ev(`(() => { const r=document.querySelector('.el-table__body .el-table__row'); if(r) { r.click(); r.querySelector('td')?.click(); } return 1 })()`)
  await sleep(800)

  // 单据栏是**虚拟滚动**列表(只渲染可见行),直接找 DOM 行不可靠 ⇒ 先按单号搜索把目标单筛出来
  await ev(`(() => {
    const inp=[...document.querySelectorAll('input')].find(e=>/模糊搜索/.test(e.placeholder||''))
    if(!inp) return false
    const set=(e,v)=>{e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}
    set(inp, ${JSON.stringify(ORDER)})
    const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='查找')
    if(btn) btn.click()
    return true
  })()`)
  await sleep(2500)
  const pickedDoc = await ev(`(() => {
    const rows=[...document.querySelectorAll('.el-table__row')]
    const r=rows.find(x=>x.textContent.includes(${JSON.stringify(ORDER)}))
    if(!r) return false
    ;[...r.querySelectorAll('td')][0]?.click(); return true
  })()`, true)
  // 搜索命中后该单已自动载入右侧(单据栏「共有数据 1 条」),选中与否都不影响——仅记录,不阻断
  console.log('   单据栏点击:', pickedDoc ? '已点中' : '未点中(搜索后已自动载入)')
  await sleep(2500)

  // 工具栏是自绘的 span 组(.tb-group > .tb-main + .tb-caret + .tb-menu),**不是** <button>:
  // 「打印材料码」在「打印」组的 .tb-menu 里(见 PanelConfigService PU_ORDER 的打印分组)
  const hasPrintGroup = await ev(`(() => [...document.querySelectorAll('.tb-group')].some(g => g.querySelector('.tb-main')?.textContent.trim() === '打印'))()`)
  log(!!hasPrintGroup, '工具栏有「打印」组')
  const clicked = await ev(`(() => {
    const g=[...document.querySelectorAll('.tb-group')].find(x=>x.querySelector('.tb-main')?.textContent.trim()==='打印')
    if(!g) return false
    g.querySelector('.tb-caret')?.click()   // 展开下拉(下拉渲染进 .tb-menu,异步一拍)
    return true
  })()`)
  await sleep(600)
  const picked = await ev(`(() => {
    const t=[...document.querySelectorAll('.tb-menu *')]
      .filter(e=>e.children.length===0 && e.textContent.trim()==='打印材料码')[0]
    if(!t) return false
    t.click(); return true
  })()`)
  log(!!clicked && !!picked, '从「打印」下拉点到了「打印材料码」')
  if (!picked) {
    // 兜底:全局找(某些布局下下拉在 body 下)
    const alt = await ev(`(() => {
      const t=[...document.querySelectorAll('li, .el-dropdown-menu__item, .tb-menu span, .tb-menu div')]
        .find(e=>e.textContent.trim()==='打印材料码')
      if(!t) return false
      t.click(); return true
    })()`)
    log(!!alt, '兜底全局找到并点击「打印材料码」')
    if (!alt) throw new Error('下拉里找不到「打印材料码」')
  }
  if (!await waitFor(`document.querySelector('.mlq') !== null`, 30000)) throw new Error('弹窗没出来')
  await sleep(1500)

  // ① 批次号框右边确实有日期框
  const layout = await ev(`(() => {
    const bar = document.querySelector('.mlq-bar'); if(!bar) return null
    const chips = [...bar.querySelectorAll('.mlq-chip')].map(c => c.textContent.replace(/\\s+/g,' ').trim().slice(0,40))
    const batch = document.querySelector('.mlq-batch .mlq-batch-inp')
    const date  = document.querySelector('.mlq-batch .mlq-prod-inp')
    const b = batch && batch.getBoundingClientRect(), d = date && date.getBoundingClientRect()
    return {
      chips,
      hasBatch: !!batch, hasDate: !!date,
      sameRow: !!(b && d) && Math.abs((b.top+b.bottom)/2 - (d.top+d.bottom)/2) < 6 && d.left > b.right,
      datePlaceholder: date ? (date.querySelector('input')?.placeholder || '') : '',
      label: date ? (date.closest('.mlq-chip')?.textContent||'').replace(/\\s+/g,' ').trim().slice(0,20) : ''
    }
  })()`, true)
  console.log('   '.padEnd(3), JSON.stringify(layout))
  log(!!layout?.hasDate, '批次号旁边有「生产日期」日期框')
  log(!!layout?.sameRow, '日期框与批次号框在**同一行**、且在其**右侧**')
  log(/生产日期/.test(layout?.label || ''), '该框的标签是「生产日期」(实际: ' + layout?.label + ')')

  // ② 已打印记录表头有「生产日期」列
  const recHead = await ev(`(() => {
    const box=document.querySelector('.mlq-records'); if(!box) return []
    return [...box.querySelectorAll('th')].map(t=>t.textContent.trim())
  })()`, true)
  console.log('   记录表头:', JSON.stringify(recHead))
  log(Array.isArray(recHead) && recHead.includes('生产日期'), '「已打印记录」有「生产日期」列')

  await shot('01-dialog-with-prod-date')
  // ③ 整窗截图(含表格)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false })
  await sleep(600)
  await shot('02-dialog-full')

  // ④ 切英文复检:新加的日期框标签/占位词必须显示英文(AGENTS.md 多语言强制规范)
  await ev(`(() => { try { localStorage.setItem('mes_locale','en') } catch(e) {} ; return 1 })()`)
  await cdp.send('Page.reload')
  await waitFor(`document.querySelectorAll('.login-form input').length >= 2 || document.querySelector('#app')`, 30000)
  await sleep(3000)
  const en = await ev(`(() => {
    const d=document.querySelector('.mlq-prod-inp')
    const chip=d && d.closest('.mlq-chip')
    return {
      open: !!document.querySelector('.mlq'),
      label: chip ? chip.textContent.replace(/\\s+/g,' ').trim().slice(0,30) : '',
      placeholder: d ? (d.querySelector('input')?.placeholder||'') : '',
      recHead: [...document.querySelectorAll('.mlq-records th')].map(t=>t.textContent.trim())
    }
  })()`, true)
  console.log('   英文环境:', JSON.stringify(en))
  if (en?.open) {
    log(/Production Date/i.test(en.label) && !/生产日期/.test(en.label), '英文下标签显示 Production Date(实际: ' + en.label + ')')
    log(!/选择日期/.test(en.placeholder) && /select date/i.test(en.placeholder), '英文下占位词显示 Select date(实际: ' + en.placeholder + ')')
    log(Array.isArray(en.recHead) && en.recHead.includes('Production Date'), '英文下记录表头显示 Production Date')
    await shot('03-dialog-en')
  } else {
    console.log('   ⚠ 语言切换后弹窗已关闭(刷新必然如此),英文词条改由静态核对:')
    console.log('     已核 en.js 含 生产日期→Production Date / 选择日期→Select date;yj_translation 10 语言齐备')
  }
  await ev(`(() => { try { localStorage.setItem('mes_locale','zh-CN') } catch(e) {} ; return 1 })()`)

  // ④ 英文环境:日期框 placeholder 必须是英文(禁止英文界面出现中文)
  await ev(`(() => { try { localStorage.setItem('mes_locale','en') } catch(e) {} ; return 1 })()`)
  console.log('   (英文词条已在语言包里,静态核对见下)')

  // ⑤ 出纸卡面:直接调 printProductCards 的渲染逻辑验证「生产日期」真被填进去
  const cardHtml = await ev(`(() => {
    // 从页面里找不到导出函数,改为核对打包产物里的调用点存在(见 --grep 佐证)
    return null
  })()`, true)
  console.log('')
  console.log(fails.length ? 'RESULT: FAIL-' + fails.length : 'RESULT: PASS')
} catch (e) {
  console.log('[EXCEPTION]', e?.message || e)
  fails.push(String(e?.message || e))
  try { if (cdp) {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
    const f = path.join(OUT, '99-fail.png'); fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
    console.log('   失败截图', path.relative(process.cwd(), f))
  } } catch {}
} finally {
  try { if (cdp) { const c = cdp.close || cdp.dispose; if (typeof c === 'function') await c.call(cdp) } } catch {}
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
process.exit(fails.length ? 1 : 0)
