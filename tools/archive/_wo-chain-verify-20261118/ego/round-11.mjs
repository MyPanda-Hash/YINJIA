// round-11: 8090 打包版(正式库只读)验证第二轮日期口径
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto('http://127.0.0.1:8090/#/prod/plan/scheduleBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(5000)
const logged = await page.evaluate(() => !!document.querySelector('.sb-page'))
console.log('logged in=' + logged)
if (!logged) {
  await page.evaluate(() => { localStorage.clear() })
  await page.goto('http://127.0.0.1:8090/#/login', { timeout: 60000 })
  await page.reload({ timeout: 60000 })
  await sleep(2500)
  await page.fill('input[placeholder="请输入登录账号"]', 'admin')
  await page.fill('input[placeholder="请输入登录密码"]', '123456')
  await page.click('text="进入系统"')
  await sleep(4500)
  await page.goto('http://127.0.0.1:8090/#/prod/plan/scheduleBoard', { timeout: 60000 })
  await page.reload({ timeout: 60000 })
  await sleep(5000)
}
await page.evaluate(() => {
  const sw = document.querySelector('.sb-head .el-switch')
  if (sw && !sw.classList.contains('is-checked')) sw.click()
})
await sleep(2500)
await page.fill('input[placeholder*="加工单号 / 行号"]', 'GD-2026-10-0228 切炭4(X)')
await sleep(1500)
await page.evaluate(() => {
  const blocks = [...document.querySelectorAll('.sb-block')]
  const tr = [...blocks[1].querySelectorAll('.el-table__body tr')].find((x) => (x.textContent || '').includes('GD-2026-10-0228'))
  if (tr) tr.click()
})
await sleep(900)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '预排线')
  if (b) b.click()
})
await sleep(3500)
const dlg = await page.evaluate(() => {
  const d = document.querySelector('.el-dialog')
  if (!d) return { open: false }
  return {
    open: true,
    rows: [...d.querySelectorAll('.el-table__body tr')].map((tr) => ({
      op: (tr.querySelector('td:nth-child(2)') || {}).textContent,
      inputs: [...tr.querySelectorAll('input')].map((i) => i.value),
    })),
    tip: [...d.querySelectorAll('.prp-dim')].map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim())[0],
  }
})
console.log(JSON.stringify(dlg, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await sleep(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-11-8090-round2.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
