/**
 * round-09:改完标题/「上次混料单」标签后复看(手机 390 宽):
 * ① 列表页展开「已完成」;② 明细页(未完成)抬头;③ 已保存单据只读页。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(400)

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 30000 })
await page.waitForTimeout(3000)
// 用 DOM 直接点「已完成」组的组头(页面上「已完成」文本多处出现,语义选择器会歧义)
const opened = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.mm-grp-head')]
  const head = heads[heads.length - 1]
  if (head) head.click()
  return { headCount: heads.length, headText: head ? head.innerText.replace(/\s+/g, ' ').trim() : '' }
})
await page.waitForTimeout(900)
const listText = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.mm-card')]
  const last = cards[cards.length - 1]
  return {
    doneBlock: last ? last.innerText.replace(/\s+/g, ' ').trim().slice(0, 500) : '',
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  }
})
console.log('== 列表页(已完成展开,390 宽) ==')
console.log(JSON.stringify({ opened, ...listText }, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-09-mobile-done.png', fullPage: true })

// 明细页(未完成):标题应显示「混料单」,抬头「上次混料单」= PL2611170001
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(2500)
const docHead = await page.evaluate(() => ({
  title: (document.querySelector('.mp-title') || {}).innerText || '',
  state: (document.querySelector('.mp-state') || {}).innerText || '',
  kv: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
}))
console.log('== 明细页(未完成)抬头 ==')
console.log(JSON.stringify(docHead, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-09-mobile-doc.png' })

// 已保存单据(只读):标题应是单号
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN/doc?docNo=PL2611170001', { timeout: 30000 })
await page.waitForTimeout(2500)
const savedHead = await page.evaluate(() => ({
  title: (document.querySelector('.mp-title') || {}).innerText || '',
  state: (document.querySelector('.mp-state') || {}).innerText || '',
  kv: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  readonly: !!document.querySelector('.mp-ro'),
  footButtons: [...document.querySelectorAll('.mp-foot button')].map((b) => (b.textContent || '').trim()),
}))
console.log('== 已保存单据(只读)抬头 ==')
console.log(JSON.stringify(savedHead, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-09-mobile-saved.png' })

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
