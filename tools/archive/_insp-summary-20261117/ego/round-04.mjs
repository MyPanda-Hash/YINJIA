// round-04:8090(正式库)完整取证:本月 → 按送样人 / 按委托单 / 展开 / 导出 / English
const OUT = 'C:/Users/vigna/ego/insp-summary-20261117'
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
const shot = async (name) => {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
}
const state = async (tag) => console.log(tag, JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  factory: localStorage.getItem('mes_factory'),
  title: document.querySelector('.iss-title')?.textContent?.trim() || '',
  quick: [...document.querySelectorAll('.el-radio-button')].filter((n) => n.className.includes('is-active')).map((n) => (n.textContent || '').trim()),
  range: [...document.querySelectorAll('.iss-range input')].map((i) => i.value),
  stats: [...document.querySelectorAll('.iss-stat')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  tabs: [...document.querySelectorAll('.iss-tabs .el-tabs__item')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  rowTexts: [...document.querySelectorAll('.iss-table .el-table__body-wrapper tbody tr')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 5),
}))))

await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(4000)
// 会话过期则登录(工厂下拉默认项;登录后核对 mes_factory)
const needLogin = await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
  await page.waitForTimeout(3500)
}
await state('A')

// 本月
await page.evaluate(() => document.querySelectorAll('.el-radio-button__inner').length
  ? [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click()
  : null)
await page.waitForTimeout(3000)
await state('B')
await shot('07-8090-month-sender')

// 按委托单/样品
await page.evaluate(() => [...document.querySelectorAll('.iss-tabs .el-tabs__item')].find((n) => (n.textContent || '').includes('按委托单'))?.click())
await page.waitForTimeout(1500)
console.log('DOCS', JSON.stringify(await page.evaluate(() => ({
  rowTexts: [...document.querySelectorAll('.iss-tabs .el-tab-pane')][1]
    ? [...[...document.querySelectorAll('.iss-tabs .el-tab-pane')][1].querySelectorAll('.el-table__body-wrapper tbody tr')]
      .map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 5)
    : [],
}))))
await shot('08-8090-docs')

// 展开第一张单
await page.evaluate(() => {
  const pane = [...document.querySelectorAll('.iss-tabs .el-tab-pane')][1]
  pane?.querySelector('.el-table__body-wrapper .el-table__expand-icon')?.click()
})
await page.waitForTimeout(1200)
console.log('EXPAND', JSON.stringify(await page.evaluate(() => ({
  text: ([...document.querySelectorAll('.iss-tabs .el-tab-pane')][1]?.querySelector('.iss-expand')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
}))))
await shot('09-8090-expand')

// 导出 Excel
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('导出 Excel'))?.click())
await page.waitForTimeout(4500)
const fs = await import('node:fs/promises')
let downloads = []
try {
  const dir = 'C:/Users/vigna/Downloads'
  const files = await fs.readdir(dir)
  for (const f of files.filter((x) => x.includes('样品检验汇总表') && x.endsWith('.xlsx'))) {
    const st = await fs.stat(`${dir}/${f}`)
    downloads.push({ f, mtime: new Date(st.mtimeMs).toISOString(), size: st.size })
  }
  downloads.sort((a, b) => (a.mtime < b.mtime ? 1 : -1))
} catch (e) { downloads = [{ error: e.message }] }
console.log('EXPORT', JSON.stringify(downloads.slice(0, 3)))

// English 走查(还原)
const zh = await page.evaluate(() => localStorage.getItem('mes_locale'))
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload()
await page.waitForTimeout(4000)
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('This month'))?.click())
await page.waitForTimeout(2500)
console.log('EN', JSON.stringify(await page.evaluate(() => ({
  title: document.querySelector('.iss-title')?.textContent?.trim() || '',
  tabs: [...document.querySelectorAll('.iss-tabs .el-tabs__item')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  headers: [...document.querySelectorAll('.iss-tabs .el-tab-pane:nth-child(1) .el-table__header-wrapper th')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  buttons: [...document.querySelectorAll('.iss-controls button')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  stats: [...document.querySelectorAll('.iss-stat')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()),
  rows: [...document.querySelectorAll('.iss-table .el-table__body-wrapper tbody tr')].map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 2),
}))))
await shot('10-8090-en')
await page.evaluate((v) => localStorage.setItem('mes_locale', v || 'zh-CN'), zh)
await page.reload()
await page.waitForTimeout(2000)
await task.finish({ keep: [] })
