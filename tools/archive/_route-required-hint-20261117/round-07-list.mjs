const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const state = () => page.evaluate(() => {
  const acts = [...document.querySelectorAll('.tools .act-name')].map((s) => {
    const host = s.closest('.act, .tb-act, [class*="act"]')
    return { text: (s.textContent || '').trim(), cls: host?.className || '' }
  })
  return {
    doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
    status: (document.querySelector('.doc-status')?.textContent || '').trim(),
    pageNo: (document.querySelector('.page-no')?.textContent || '').trim(),
    acts: acts.filter((a) => a.text).slice(0, 14),
  }
})

const seen = []
for (let i = 0; i < 7; i++) {
  seen.push(await state())
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.page-btn')].find((x) => (x.textContent || '').includes('▶'))
    if (b) b.click()
  })
  await page.waitForTimeout(1500)
}
console.log(JSON.stringify(seen.map((s) => ({ doc: s.doc, status: s.status, pageNo: s.pageNo, save: s.acts.find((a) => a.text === '保存') })), null, 2))
console.log('--- 第一张的动作栏 ---')
console.log(JSON.stringify(seen[0].acts, null, 2))
