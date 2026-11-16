// round-11：删除工单（手工单删除成功 + 已排产单被拒）
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-draft-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
const clickDelete = async () => {
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '删除工单')
    btn?.click()
  })
  await sleep(1300)
  const box = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.el-message-box')].find((x) => x.getBoundingClientRect().width > 100)
    return b ? (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 320) : null
  })
  return box
}
const confirmDelete = async () => {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.el-message-box')].find((x) => x.getBoundingClientRect().width > 100)
    const btn = b ? [...b.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '确认') : null
    btn?.click()
  })
  let msgs = []
  for (let i = 0; i < 18; i++) {
    await sleep(350)
    msgs = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
    if (msgs.length) break
  }
  await sleep(1500)
  return msgs
}

// ① 勾选第一个（刚创建的手工单）→ 删除
await page.evaluate(() => {
  const tr = document.querySelector('.wol-table .el-table__body tr')
  tr?.querySelector('td .el-checkbox')?.click()
})
await sleep(700)
const confirmText = await clickDelete()
console.log('删除确认框=' + JSON.stringify(confirmText))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r11-delete-confirm.png' })
const delMsgs = await confirmDelete()
console.log('手工单删除提示=' + JSON.stringify(delMsgs))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r11-deleted.png' })
const gone = await page.evaluate(() => ({
  rows: [...document.querySelectorAll('.wol-table .el-table__body tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)),
}))
console.log('删除后列表=' + JSON.stringify(gone))

// ② 已排产工单删除 → 后端拒绝，提示原样弹出
await page.evaluate(() => {
  const inp = document.querySelector('input[placeholder="输入查询条件..."]')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'GD-QTY-TEST-11')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
})
await sleep(300)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-query button')].find((b) => (b.textContent || '').trim() === '查找')
  btn?.click()
})
await sleep(3200)
await page.evaluate(() => {
  const tr = document.querySelector('.wol-table .el-table__body tr')
  tr?.querySelector('td .el-checkbox')?.click()
})
await sleep(700)
const confirmText2 = await clickDelete()
console.log('已排产单删除确认框=' + JSON.stringify(confirmText2))
const rejectMsgs = await confirmDelete()
console.log('已排产单删除提示=' + JSON.stringify(rejectMsgs))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r11-reject.png' })
console.log('pageerrors=' + JSON.stringify(errors))
