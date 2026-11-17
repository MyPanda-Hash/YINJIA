// round-07:顺序调整后的英文界面(未完成默认在最左)+ 还原简中
const OUT = 'C:/Users/vigna/ego/oqc-rail-tabs-20261110'
const task = await taskSpace('oqc-rail-tabs-20261110')
const page = task.page('p1')

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

const probe = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    htmlLang: document.documentElement.lang,
    tabs: [...document.querySelectorAll('.dsr-tabs .dsr-tab')].map((b) => ({ text: b.textContent.trim(), active: b.classList.contains('active') })),
    count: txt(q('.dsr-count')),
    firstTag: txt(q('.dsr-grid tbody .dsr-tag')),
    errToasts: [...document.querySelectorAll('.el-message--error')].map((e) => e.textContent.trim()),
  }
})

await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.evaluate(() => location.reload())
await page.waitForTimeout(9000)
console.log('EN=' + JSON.stringify(await probe()))
await shot('round-07-en-default')

await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.evaluate(() => location.reload())
await page.waitForTimeout(8000)
console.log('RESTORED=' + JSON.stringify(await probe()))
await shot('round-07-restored-zh')
