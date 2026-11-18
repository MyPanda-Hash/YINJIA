// round-18: 界面复验 —— 打开草稿 IJ-2026-11-0017(合格数量空)点「保存」/「审核」,看是否被拦
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
const BASE = 'http://localhost:5173'
const DOC = 'IJ-2026-11-0017'

await page.goto(`${BASE}/#/panelx/list/QC_INSP`, { timeout: 30000 })
await page.waitForTimeout(4000)
const need = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('登录账号')))
if (need) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456')
  })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click())
  await page.waitForTimeout(6000)
  await page.goto(`${BASE}/#/panelx/list/QC_INSP`, { timeout: 30000 })
}
await page.reload({ timeout: 30000 })
await page.waitForTimeout(9000)
console.log('账套 =', await page.evaluate(() => (document.querySelector('.factory .factory-name')?.textContent || '').trim()))

// 左栏找这张单(最新日期,通常在首屏)
const found = await page.evaluate((doc) => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  for (const tr of rows) {
    if ((tr.textContent || '').includes(doc)) {
      const first = tr.querySelector('td')
      ;(first || tr).click()
      return true
    }
  }
  return rows.slice(0, 3).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80))
}, DOC)
console.log('左栏命中 =', JSON.stringify(found))
await page.waitForTimeout(5000)

const before = await page.evaluate(() => ({
  headerNo: [...document.querySelectorAll('input')].map((i) => i.value).find((v) => String(v).startsWith('IJ-')),
  gridRows: [...document.querySelectorAll('.el-table__body tbody tr')].slice(0, 2).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim()).join(' | ')),
  requiredCols: [...document.querySelectorAll('.col-hdr-text.req')].map((e) => (e.textContent || '').trim()),
}))
console.log('单据 =', JSON.stringify(before, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-18-draft.png' })

/** 点工具栏某个动作(span.tb-main) */
async function toolbar(name) {
  const clicked = await page.evaluate((n) => {
    const cands = [...document.querySelectorAll('.tb-main, .tool-btn, .as-side-btn, button')]
      .filter((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === n)
    if (!cands.length) return 'none'
    cands[0].click()
    return cands.length
  }, name)
  await page.waitForTimeout(3500)
  const out = await page.evaluate(() => ({
    messages: [...document.querySelectorAll('.el-message, .el-message-box__message, .el-notification__content')]
      .map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
    blink: [...document.querySelectorAll('.field-blink, .cell-blink, .blink')].length,
  }))
  return { clicked, ...out }
}

console.log('点「保存」 =', JSON.stringify(await toolbar('保存'), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-18-save-blocked.png' })
// 关掉可能的提示弹窗
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box button')].find((x) => /知道了|确定|OK/.test((x.textContent || '')))
  if (b) b.click()
})
await page.waitForTimeout(800)
console.log('点「审核」 =', JSON.stringify(await toolbar('审核'), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-18-audit-blocked.png' })
console.log('done round-18')
