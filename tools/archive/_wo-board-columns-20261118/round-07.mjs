// round-07:打包版(8090,前端在 jar 里)复核 —— 列设置按钮在、弹窗可开、锁定列带锁
const task = await taskSpace('wo-board-column-settings-20261118')
const page = await task.newPage()

await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(6000)
let hash = await page.evaluate(() => location.hash)
if (hash.includes('login')) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(5000)
  await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 40000 })
  await page.waitForTimeout(6000)
}
await page.evaluate(() => {
  const lines = [...document.querySelectorAll('.wb-line')]
  const hit = lines.find((el) => !el.classList.contains('off')) || lines[0]
  if (hit) hit.click()
})
await page.waitForTimeout(4000)

const st = await page.evaluate(() => ({
  hash: location.hash,
  列设置按钮: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === '列设置'),
  表头列数: document.querySelectorAll('.el-table__header th').length,
  日期列: [...document.querySelectorAll('.el-table__header th .dp-date')].map((el) => el.textContent.trim()),
}))
console.log(JSON.stringify(st, null, 2))

await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '列设置')
  if (btn) btn.click()
})
await page.waitForTimeout(1200)
const dlg = await page.evaluate(() => ({
  弹窗: !!document.querySelector('.csd-dialog .csd-list'),
  锁定条目: [...document.querySelectorAll('.csd-item.is-locked .csd-label')].map((el) => el.textContent.trim()),
  条目数: document.querySelectorAll('.csd-item').length,
}))
console.log(JSON.stringify(dlg, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-board-column-settings-20261118/round-07-8090.png' })
