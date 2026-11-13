// 2026-11-13 round-03:手机端超量弹窗终验(不提交任何真实报工 —— 只触发前端预检弹窗)
// 数据:GD-2026-11-0012 行3;成型 600/2500(可报 1900);装箱 1100/5000(可加工量 1200 ⇒ 可报 100)
const task = await taskSpace('mob-report-cap-20261113')
const page = task.page('p1')
const BASE = 'http://localhost:5173'
const OUT = 'C:/Users/vigna/ego/mob-report-cap-20261113/'
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
const dlgVisible = () => page.evaluate(() => {
  const d = document.querySelector('.mp-cap-dlg')
  if (!d) return false
  const r = d.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && getComputedStyle(d).display !== 'none'
})
async function setQty(v) {
  await page.evaluate((val) => {
    const setVal = (el, input) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, input); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const inp = document.querySelector('.mp-qty input')
    if (inp) { inp.focus(); setVal(inp, String(val)); inp.blur() }
  }, v)
  await page.waitForTimeout(500)
}
async function queryWo() {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const inp = document.querySelector('.mp-card input')
    if (inp) setVal(inp, 'GD-2026-11-0012')
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-row .el-button')].find((x) => (x.textContent || '').includes('查询')); if (b) b.click() })
  await page.waitForTimeout(4500)
}
async function pickPacking() {
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.mp-op')].find((x) => (x.querySelector('.mp-op-name') || {}).textContent?.trim() === '装箱')
    if (el) el.click()
  })
  await page.waitForTimeout(600)
}
async function readDlg() {
  return page.evaluate(() => {
    const d = document.querySelector('.mp-cap-dlg')
    if (!d) return { found: false }
    const r = d.getBoundingClientRect()
    return {
      found: true, w: Math.round(r.width), iw: innerWidth,
      title: (d.querySelector('.el-dialog__title') || {}).textContent?.trim() || '',
      max: (d.querySelector('.mp-cap-max') || {}).textContent?.trim() || '',
      unit: (d.querySelector('.mp-cap-unit') || {}).textContent?.trim() || '',
      lines: [...d.querySelectorAll('.mp-cap-line, .mp-cap-formula, .mp-cap-tip')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
      btns: [...d.querySelectorAll('.mp-cap-actions .el-button')].map((b) => (b.textContent || '').trim()),
    }
  })
}
async function closeDlg(btnText) {
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll('.mp-cap-dlg .mp-cap-actions .el-button')].find((x) => (x.textContent || '').includes(t))
    if (b) b.click()
  }, btnText)
  await page.waitForTimeout(700)
}

// ── 手机比例 390x844 ──
try { await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }) } catch (e) { console.log('emu skip: ' + e.message) }
await page.goto(BASE + '/#/panelx/list/MOBILE_REPORT', { timeout: 40000 })
await page.waitForTimeout(6000)
await restoreWindow()
if (await page.evaluate(() => !!document.querySelector('input[type="password"]'))) {
  console.log('login required')
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')) ?? ins[0], 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')) ?? ins[1], '123456')
    document.querySelector('.login-form .el-select')?.click()
  })
  await page.waitForTimeout(1200)
  await page.evaluate(() => { const items = [...document.querySelectorAll('.el-select-dropdown__item')]; const el = items.find((x) => { const t = (x.textContent || '').trim(); return t.includes('YINJIA-MES') && !t.includes('测试') }); if (el) el.click() })
  await page.waitForTimeout(500)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统')); if (b) b.click() })
  await page.waitForTimeout(6500)
  await page.goto(BASE + '/#/panelx/list/MOBILE_REPORT', { timeout: 40000 })
  await page.waitForTimeout(6000)
}
await restoreWindow()
await queryWo()
await pickPacking()
console.log('ops=' + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.mp-op')].map((el) => ({
  name: (el.querySelector('.mp-op-name') || {}).textContent?.trim() || '',
  flow: (el.querySelector('.mp-op-flow') || {}).textContent?.replace(/\s+/g, ' ').trim() || '',
})))))
// ① 填 200:按钮下方立刻出现「本次最多可报 100」
await setQty(200)
console.log('hint=' + JSON.stringify(await page.evaluate(() => (document.querySelector('.mp-warn') || {}).textContent?.trim() || '')))
await page.screenshot({ path: OUT + 'final-01-mobile-hint.png' })
// ② 提交 → 前端预检弹窗(不发请求)
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-submit .el-button')].find((x) => (x.textContent || '').includes('提交报工')); if (b) b.click() })
await page.waitForTimeout(1500)
console.log('mobileDialog=' + JSON.stringify(await readDlg()))
await page.screenshot({ path: OUT + 'final-02-mobile-dialog.png' })
// ③ 改为 100 → 数量变 100、弹窗关
await closeDlg('改为')
console.log('afterApply=' + JSON.stringify(await page.evaluate(() => ({
  qty: (document.querySelector('.mp-qty input') || {}).value || '',
  hint: (document.querySelector('.mp-warn') || {}).textContent?.trim() || '',
}))))
await page.screenshot({ path: OUT + 'final-03-mobile-applied.png' })
// ④ 确认没有真的提交(今日报工仍为空;工序台账 装箱 已报仍 1100)
console.log('今日报工=' + JSON.stringify(await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.mp-line')]
  return { count: lines.length, text: (document.querySelector('.mp-right') || {}).textContent?.replace(/\s+/g, ' ').trim()?.slice(0, 120) || '' }
})))

// ── 桌面宽度(同一组件):弹窗最大 420 ──
try { await page.cdp('Emulation.clearDeviceMetricsOverride', {}) } catch (e) { console.log('clear skip: ' + e.message) }
await page.waitForTimeout(900)
await restoreWindow()
await setQty(200)
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-submit .el-button')].find((x) => (x.textContent || '').includes('提交报工')); if (b) b.click() })
await page.waitForTimeout(1200)
console.log('wideDialog=' + JSON.stringify(await readDlg()))
await page.screenshot({ path: OUT + 'final-04-wide-dialog.png' })
await closeDlg('知道了')

// ── 英文:顶栏切 English 后再触发一次,看文案是否全英文 ──
await page.evaluate(() => document.querySelector('.locale-switch')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
await page.waitForTimeout(900)
await page.evaluate(() => { const items = [...document.querySelectorAll('.el-dropdown-menu__item, .el-dropdown-menu li')]; const el = items.find((x) => /English/i.test(x.textContent || '')); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
await page.waitForTimeout(2000)
await setQty(200)
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-submit .el-button')].find((x) => (x.textContent || '').includes('Submit') || (x.textContent || '').includes('提交报工')); if (b) b.click() })
await page.waitForTimeout(1500)
console.log('enDialog=' + JSON.stringify(await readDlg()))
await page.screenshot({ path: OUT + 'final-05-en-dialog.png' })
await closeDlg('Got it')
// 切回中文
await page.evaluate(() => document.querySelector('.locale-switch')?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
await page.waitForTimeout(900)
await page.evaluate(() => { const items = [...document.querySelectorAll('.el-dropdown-menu__item, .el-dropdown-menu li')]; const el = items.find((x) => /简体中文/.test(x.textContent || '')); if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
await page.waitForTimeout(1200)
console.log('DONE')
