// round-01 — 首件检验单「选生产工单」弹窗文案(按天口径)zh/en × 5173/8090
const out = 'C:/Users/vigna/ego/first-insp-daily-20261112'
const task = await taskSpace('first-insp-daily-20261112')
const page = task.page('p1')

async function loginIfNeeded() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
  if (!need) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(9000)
  return true
}
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip') }
}
const PICKERS = ['选生产工单', 'select work order', 'pick production']
async function openPicker(base, locale) {
  await page.goto(base + '/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 })
  await page.waitForTimeout(3000)
  await loginIfNeeded()
  await page.evaluate((l) => { try { localStorage.setItem('mes_locale', l) } catch (e) {} }, locale)
  await page.reload({ timeout: 30000 })
  await page.waitForTimeout(5000)
  await loginIfNeeded()
  await page.goto(base + '/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 })
  await page.waitForTimeout(4000)
  const clicked = await page.evaluate((PICKERS) => {
    const btn = [...document.querySelectorAll('.as-side-btn')].find((e) => {
      const t = (e.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
      return PICKERS.some((p) => t.includes(p.toLowerCase()))
    })
    if (!btn) return false
    btn.click()
    return true
  }, PICKERS)
  if (!clicked) throw new Error('找不到「选生产工单」按钮 locale=' + locale)
  await page.waitForSelector('.wopick-tip', { timeout: 20000 })
  await page.waitForTimeout(900)
  return await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null) || document
    return {
      hash: location.hash,
      lang: localStorage.getItem('mes_locale'),
      tip: (dlg.querySelector('.wopick-tip')?.textContent || '').trim(),
      gate: (dlg.querySelector('.wopick-gate')?.textContent || '').trim(),
      headers: [...dlg.querySelectorAll('.el-table__header-wrapper th')].map((x) => (x.textContent || '').trim()).filter(Boolean),
      rowCount: dlg.querySelectorAll('.el-table__body-wrapper tbody tr').length,
    }
  })
}
const zh = await openPicker('http://localhost:5173', 'zh-CN')
console.log('ZH5173=' + JSON.stringify(zh))
await restoreWindow(); await page.screenshot({ path: out + '/round-01-picker-5173.png' })
const en = await openPicker('http://localhost:5173', 'en')
console.log('EN5173=' + JSON.stringify(en))
await restoreWindow(); await page.screenshot({ path: out + '/round-02-en-5173.png' })
const zh8090 = await openPicker('http://127.0.0.1:8090', 'zh-CN')
console.log('ZH8090=' + JSON.stringify(zh8090))
await restoreWindow(); await page.screenshot({ path: out + '/round-03-picker-8090.png' })
console.log('DONE')
