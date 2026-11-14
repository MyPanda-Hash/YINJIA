// round-07:翻页找一张「草稿」状态的采购入库单并选中,打印可用动作
const task = await taskSpace('stock-sync-kingdee-20261110')
const page = task.page('p1')

function scanJs() {
  const rows = [...document.querySelectorAll('tbody tr')]
  for (let i = 0; i < rows.length; i++) {
    const cells = [...rows[i].querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
    if (cells.includes('草稿')) return { found: true, idx: i, cells: cells.slice(0, 8) }
  }
  return { found: false, rowCount: rows.length }
}

let hit = null
for (let p = 0; p < 5; p++) {
  const s = await page.evaluate(scanJs)
  console.log(`第 ${p + 1} 屏:` + JSON.stringify(s))
  if (s.found) { hit = s; break }
  // 下一页
  const moved = await page.evaluate(() => {
    const next = [...document.querySelectorAll('button, .el-pager li, .pager-next, [class*="next"]')]
      .find((el) => /next|下一页|›|»/.test((el.className || '') + (el.textContent || '')))
    if (next) { next.click(); return true }
    return false
  })
  if (!moved) { console.log('没找到下一页按钮'); break }
  await page.waitForTimeout(2500)
}

if (hit) {
  await page.evaluate((idx) => {
    const rows = [...document.querySelectorAll('tbody tr')]
    const tr = rows[idx]
    if (tr) { const c = tr.querySelector('td'); if (c) c.click(); tr.click() }
  }, hit.idx)
  await page.waitForTimeout(1500)
  const acts = await page.evaluate(() => [...document.querySelectorAll('*')]
    .filter((el) => {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
      return ['审核', '转ERP', '弃审', '保存'].includes(t) && el.getBoundingClientRect().width > 0 && el.children.length === 0
    })
    .map((el) => ({ t: (el.textContent || '').trim(), cls: String(el.className).slice(0, 40) })))
  console.log('动作:', JSON.stringify(acts))
}
