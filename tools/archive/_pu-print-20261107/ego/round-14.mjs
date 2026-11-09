// round-14:弹窗内「打印版式」切换(有金额 → 无金额)实时生效 + 截图
const task = await taskSpace('po-print-edit-20261107')
const page = task.page('p1')
await page.waitForTimeout(400)

// 打开有金额弹窗
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-group .tb-main')].find((n) => (n.textContent || '').trim() === '打印')
  if (el) el.click()
})
await page.waitForTimeout(2500)

const before = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    title: txt(document.querySelector('.el-dialog__header')),
    headers: [...root.querySelectorAll('.el-table__header th')].map(txt),
    foot: txt(root.querySelector('.pup-foot')),
  }
})
console.log('before=' + JSON.stringify(before, null, 2))

// 真实点击「无金额」
await page.click('css=.pup .el-radio-button:has-text("无金额")', { label: 'switch to no-amount format' })
await page.waitForTimeout(1200)

const after = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const root = document.querySelector('.pup')
  return {
    title: txt(document.querySelector('.el-dialog__header')),
    headers: [...root.querySelectorAll('.el-table__header th')].map(txt),
    foot: txt(root.querySelector('.pup-foot')),
    radio: [...root.querySelectorAll('.el-radio-button')].map((el) => ({ t: txt(el), on: el.className.includes('is-active') })),
  }
})
console.log('after=' + JSON.stringify(after, null, 2))

try {
  const p = await page.screenshot({ path: 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-14-noamount.png' })
  console.log('shot=' + p)
} catch (e) {
  console.log('shot fail: ' + e.message)
  try {
    const res = await page.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false })
    const fs = await import('node:fs/promises')
    const p = 'C:/Users/Lenovo/ego/po-print-edit-20261107/round-14-noamount.png'
    await fs.writeFile(p, Buffer.from(res.data, 'base64'))
    console.log('raw shot=' + p)
  } catch (e2) { console.log('raw shot fail: ' + e2.message) }
}

await page.keyboard.press('Escape')
await page.waitForTimeout(600)
