// round-34: 面板界面复核(打印电脑清单 = 开关 + 类型勾选)
const task = await taskSpace(1)
const page = task.page('p1')
await page.reload()
await page.waitForTimeout(3500)
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 30000 })
await page.waitForTimeout(3500)
console.log(JSON.stringify(await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    title: q('.ps-title'), sub: q('.ps-sub'), badge: q('.ps-badge'),
    secs: q('.ps-sec'), kvs: q('.ps-kv'),
    stations: [...document.querySelectorAll('.ps-station')].map((el) => ({
      text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      switchOn: !!el.querySelector('.el-switch.is-checked'),
      checked: [...el.querySelectorAll('.el-checkbox')].map((c) => ({ label: (c.textContent || '').trim(), on: c.classList.contains('is-checked') })),
    })),
  }
}), null, 2))
try {
  const shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/printstation-v2.png' })
  console.log({ shot })
} catch (e) { console.log('shot fail: ' + e.message) }
