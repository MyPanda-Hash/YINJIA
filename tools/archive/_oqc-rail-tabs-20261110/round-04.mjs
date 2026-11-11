// round-04:真刷新后的英文界面页签译名(en),再还原简中
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
    kwPlaceholder: q('.dsr-kw input')?.placeholder || null,
    firstStatusTag: txt(q('.dsr-grid tbody .dsr-tag')),
    errToasts: [...document.querySelectorAll('.el-message--error')].map((e) => e.textContent.trim()),
  }
})

// en:改 localStorage 后**整页刷新**(同 hash 的 goto 不会重载 SPA)
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.evaluate(() => location.reload())
await page.waitForTimeout(9000)
console.log('EN=' + JSON.stringify(await probe()))
await shot('round-04-en-tabs')

// 点一次「Done」确认英文下页签交互仍正常
await page.evaluate(() => { const b = [...document.querySelectorAll('.dsr-tabs .dsr-tab')].pop(); if (b) b.click() })
await page.waitForTimeout(2500)
console.log('EN_CLICK=' + JSON.stringify(await probe()))
await shot('round-04-en-tab-clicked')

// 还原简中
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.evaluate(() => location.reload())
await page.waitForTimeout(8000)
console.log('RESTORED=' + JSON.stringify(await probe()))
await shot('round-04-restored-zh')
