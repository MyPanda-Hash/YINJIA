const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
const box = await page.evaluate(() => {
  const tr = document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')[1]
  const td = tr ? tr.querySelector('td.c-std') : null
  if (!td) return null
  const r = td.getBoundingClientRect()
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height - 12) }
})
console.log('hover=' + JSON.stringify(box))
if (box) {
  await page.mouse.move(box.x, box.y)
  await page.waitForTimeout(1200)
  const tip = await page.evaluate(() => {
    const p = document.querySelector('.qc-std-tip')
    if (!p) return null
    const cs = getComputedStyle(p)
    const r = p.getBoundingClientRect()
    return { bg: cs.backgroundColor, opacity: cs.opacity, w: Math.round(r.width), h: Math.round(r.height) }
  })
  console.log('tip=' + JSON.stringify(tip))
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-60-tooltip.png' })
}
