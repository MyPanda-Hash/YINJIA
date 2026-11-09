// round-19: 英文界面点已转单据的转ERP —— 提示必须是英文;验完切回简体中文
const fs = await import('node:fs/promises')
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
await page.waitForTimeout(1500)
console.log('toolbar=' + JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('span.tb-main')].map((s) => (s.textContent || '').trim()).slice(0, 12))))
await page.evaluate(() => {
  window.__toasts = []
  const seen = new Set()
  setInterval(() => {
    for (const el of document.querySelectorAll('.el-message')) {
      const t = (el.textContent || '').trim(); const cls = String(el.className || '')
      if (t && !seen.has(t + cls)) { seen.add(t + cls); window.__toasts.push({ text: t, cls }) }
    }
  }, 60)
})
const clicked = await page.evaluate(() => {
  const main = [...document.querySelectorAll('span.tb-main')].find((s) => /ERP/i.test(s.textContent || ''))
  if (!main) return 'none'
  main.click(); return (main.textContent || '').trim()
})
console.log('clicked=' + clicked)
for (const d of [300, 200]) {
  await page.waitForTimeout(d)
  try {
    const shot = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await fs.writeFile('C:/Users/Lenovo/ego/erp-already-prompt-20261109/after-warning-en.png', Buffer.from(shot.data, 'base64'))
  } catch (e) { console.log('shot skip: ' + e.message) }
}
await page.waitForTimeout(900)
console.log('TOASTS=' + JSON.stringify(await page.evaluate(() => window.__toasts.filter((t) => !t.cls.includes('leave')).map((t) => t.text))))

// 切回简体中文(别把用户界面留在英文)
await page.evaluate(() => {
  const sw = [...document.querySelectorAll('.locale-switch')][0]
  if (sw) { sw.click(); sw.dispatchEvent(new MouseEvent('click', { bubbles: true })) }
})
await page.waitForTimeout(1000)
const back = await page.evaluate(() => {
  const item = [...document.querySelectorAll('.el-dropdown-menu__item, li')].find((el) => (el.textContent || '').trim() === '简体中文')
  if (!item) return 'none'
  item.click(); return 'clicked'
})
await page.waitForTimeout(2500)
console.log('backToZh=' + back + ' toolbar=' + JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('span.tb-main')].map((s) => (s.textContent || '').trim()).slice(0, 6))))
