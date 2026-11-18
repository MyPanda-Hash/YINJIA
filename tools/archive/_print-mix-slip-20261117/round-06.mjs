const task = await taskSpace('print-mix-slip-20261117')
const page = task.page('p1')
const out = {}

async function openWith(code) {
  await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK', { timeout: 30000 })
  await page.waitForTimeout(3500)
  await page.fill('input[placeholder*="扫工单号"]', code)
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '打开单据')
    if (b) b.click()
  })
  await page.waitForTimeout(4000)
  return page.evaluate(() => ({
    hash: location.hash,
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 320),
  }))
}

// ① 扫「混料」标记码 → 应打开混料那张(LL-…0048 / id 857)
out.mix = await openWith('0@GD-2026-11-0010@1003@M')
// ② 扫「组装」标记码 → 应打开组装那张(LL-…0047 / id 856)
out.asm = await openWith('0@GD-2026-11-0010@1003@A')
// ③ 老的三段码 → 按老行为(组装)
out.old = await openWith('0@GD-2026-11-0010@1003')

for (const [k, v] of Object.entries(out)) {
  const m = /LL-2026-11-00\d\d/.exec(v.text)
  console.log(k + ' → hash=' + v.hash + ' 单号=' + (m ? m[0] : '(无)'))
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/print-mix-slip-20261117/round-06.png' })
