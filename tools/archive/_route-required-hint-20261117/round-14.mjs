const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')

// 关掉可能还开着的守卫弹窗
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-message-box')].find((b) => b.offsetParent !== null)
  const b = box ? [...box.querySelectorAll('button')].find((x) => /不保存|取消/.test(x.textContent || '')) : null
  if (b) b.click()
})
await page.waitForTimeout(1200)

// 用真实鼠标点第 1 行「工序编码」格(空白行 → 起一行并弹工序参照)
const box = await page.evaluate(() => {
  const tr = document.querySelector('.el-table__body-wrapper tbody tr')
  const td = tr?.querySelectorAll('td')?.[0]
  if (!td) return null
  const r = td.getBoundingClientRect()
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
})
console.log('cellBox:', JSON.stringify(box))
if (box) await page.mouse.click(box.x, box.y, { label: '点工序编码格' })
await page.waitForTimeout(3000)

const pick = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const box2 = [...document.querySelectorAll('.el-message-box')].find((b) => b.offsetParent !== null)
  return {
    dialogTitle: (d?.querySelector('.el-dialog__title')?.textContent || '').trim() || null,
    dialogRows: d ? d.querySelectorAll('.el-table__body-wrapper tbody tr').length : 0,
    msgBox: box2 ? (box2.querySelector('.el-message-box__title')?.textContent || '').trim() : null,
    rows: [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3).map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.innerText || '').trim())),
  }
})
console.log(JSON.stringify(pick, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-14-click.png' })
