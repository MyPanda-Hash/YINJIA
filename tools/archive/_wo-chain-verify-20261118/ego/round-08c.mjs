// round-08c: 8090 打包版冒烟(已登录,正式库只读):工单排产列设置 + 快速排产预排线
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(6000)
await page.evaluate(() => {
  const line = [...document.querySelectorAll('.wb-line')].find((el) => (el.textContent || '').includes('切炭4(X)'))
  if (line) line.click()
})
await sleep(4500)
const rows = await page.evaluate(() => [...document.querySelectorAll('.el-table__body tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90)))
console.log('board rows=' + JSON.stringify(rows.slice(0, 4)))
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '列设置')
  if (b) b.click()
})
await sleep(1500)
const cs = await page.evaluate(() => ({
  items: document.querySelectorAll('.csd-item').length,
  pins: document.querySelectorAll('.csd-pin').length,
  firstLabels: [...document.querySelectorAll('.csd-item .csd-label')].slice(0, 8).map((x) => x.textContent.trim()),
  locked: document.querySelectorAll('.csd-item.is-locked').length,
  tip: [...document.querySelectorAll('.csd-tip')].map((x) => x.textContent.trim()),
}))
console.log('column dialog=' + JSON.stringify(cs, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await sleep(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-08-8090-colsettings.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const b = [...(d ? d.querySelectorAll('button') : [])].find((x) => (x.textContent || '').trim() === '取消')
  if (b) b.click()
})
await sleep(800)
// 快速排产 → 全部 → 过滤 → 预排线(只读,最后不保存)
await page.goto('http://127.0.0.1:8090/#/prod/plan/scheduleBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(5000)
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
const dialog = await page.evaluate(() => {
  const d = document.querySelector('.el-dialog')
  if (!d) return { open: false }
  return {
    open: true,
    rows: [...d.querySelectorAll('.el-table__body tr')].map((tr) => ({
      text: (tr.textContent || '').replace(/\s+/g, ' ').trim(),
      inputs: [...tr.querySelectorAll('input')].map((i) => i.value),
    })),
  }
})
console.log('chain dialog=' + JSON.stringify(dialog, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await sleep(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-08-8090-chain.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
