// round-08:真实鼠标点击导出按钮 + 记录点击命中与 blob
const task = await taskSpace('insp-summary-20261117')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 })
await page.waitForTimeout(3500)
await page.evaluate(() => [...document.querySelectorAll('.el-radio-button__inner')].find((n) => (n.textContent || '').includes('本月'))?.click())
await page.waitForTimeout(2500)

const box = await page.evaluate(() => {
  window.__clicks = []
  window.__xlsxBlob = null
  window.__xlsxName = ''
  document.addEventListener('click', (e) => window.__clicks.push((e.target?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30)), true)
  const origCreate = URL.createObjectURL
  URL.createObjectURL = function (blob) { window.__xlsxBlob = blob; return origCreate.call(URL, blob) }
  const origClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () {
    if (String(this.download || '').endsWith('.xlsx')) { window.__xlsxName = this.download; return }
    return origClick.call(this)
  }
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('导出 Excel'))
  if (!btn) return null
  const r = btn.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }
})
console.log('BOX', JSON.stringify(box))
if (box) {
  await page.mouse.click(box.x, box.y, { label: '导出 Excel' })
  await page.waitForTimeout(6000)
  console.log('AFTER', JSON.stringify(await page.evaluate(() => ({
    clicks: window.__clicks,
    blob: window.__xlsxBlob ? window.__xlsxBlob.size : 0,
    name: window.__xlsxName,
    msgs: [...document.querySelectorAll('.el-message')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()),
  })), null, 2))
}
await task.finish({ keep: [] })
