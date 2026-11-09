// Round 08:8090 打包版 + 英文界面 终验(属性扩充后,Lead 2026-11-08)
const OUT = 'C:/Users/vigna/ego/wo-progress-board-attrs-lead-20261108'
const task = await taskSpace('wo-progress-board-attrs-lead-20261108')
const page = task.page('p1')

async function restoreWindow(p) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function shot(name) {
  await restoreWindow(page)
  console.log('shot:', await page.screenshot({ path: OUT + '/' + name }))
}
async function autoLogin() {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4500)
}

// ---------- ① 8090 看板视图(中文) ----------
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(4000)
let hash = await page.evaluate(() => location.hash)
if (String(hash).includes('/login')) { await autoLogin(); await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderProgress', { timeout: 30000 }); await page.waitForTimeout(4000) }
await page.evaluate(() => {
  const closers = [...document.querySelectorAll('.el-dialog__headerbtn, .el-message-box__headerbtn, .el-notification__closeBtn')]
  closers.forEach((b) => b.click())
  localStorage.setItem('mes_locale', 'zh-CN')
})
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4000)
await shot('round-08-8090-board.png')
const b8090 = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  return {
    origin: location.origin, hash: location.hash, rows: rows.length,
    headers: [...document.querySelectorAll('.wpb-grid-head > span')].map(txt),
    firstRow: rows.length ? txt(rows[0]).slice(0, 450) : '',
    hasProductCode: document.body.innerText.includes('产品编码'),
    hasSpec: document.body.innerText.includes('规格型号'),
    hasDemand: document.body.innerText.includes('需求数量'),
    hasBalance: document.body.innerText.includes('余量'),
    noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    menuEntry: document.body.innerText.includes('生产工序进度看板'),
  }
})
console.log('8090_BOARD:', JSON.stringify(b8090, null, 2))

// ---------- ② 英文界面(5173 源码版,验证新增标签走 tt) ----------
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.evaluate(() => { localStorage.setItem('mes_locale', 'en') })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)
const en = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    headers: [...document.querySelectorAll('.wpb-grid-head > span')].map(txt),
    firstRow: (() => { const r = document.querySelector('.wpb-grid-row'); return r ? txt(r).slice(0, 480) : '' })(),
    rowLabels: (() => { const r = document.querySelector('.wpb-grid-row'); return r ? [...r.querySelectorAll('.wpb-kv')].map(txt) : [] })(),
    hasChineseResidue: /产品编码|规格型号|需求数量|入库数量|余量|计划完工日期|计划开工日期|订单号|当前工序|生产线/.test(document.querySelector('.wpb-grid-body')?.innerText || ''),
  }
})
console.log('EN:', JSON.stringify(en, null, 2))
await shot('round-08-8090-en.png')

// 还原中文
await page.evaluate(() => { localStorage.setItem('mes_locale', 'zh-CN') })
await page.waitForTimeout(600)
console.log('ROUND8_DONE')
