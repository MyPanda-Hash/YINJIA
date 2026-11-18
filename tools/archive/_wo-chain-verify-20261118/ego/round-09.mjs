// round-09: 测试库验证第二轮日期口径:GD-2026-11-0012 行3(成型/装箱都已报工 11-11)
// 期望:成型 11-11~11-13;装箱 **开工 11-11(按实际开工)**、完工仍 11-17(原来选择的日期)
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await page.evaluate(() => { localStorage.clear() })
await page.goto('http://127.0.0.1:8091/#/login', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(2500)
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.el-select')].find((s) => (s.textContent || '').includes('YINJIA-MES'))
  if (sel) sel.querySelector('.el-select__wrapper').click()
})
await sleep(700)
await page.evaluate(() => {
  const o = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.textContent || '').includes('测试库'))
  if (o) o.click()
})
await sleep(500)
await page.fill('input[placeholder="请输入登录账号"]', 'admin')
await page.fill('input[placeholder="请输入登录密码"]', '123456')
await page.click('text="进入系统"')
await sleep(4500)
await page.goto('http://127.0.0.1:8091/#/prod/plan/scheduleBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(5000)
await page.evaluate(() => {
  const sw = document.querySelector('.sb-head .el-switch')
  if (sw && !sw.classList.contains('is-checked')) sw.click()
})
await sleep(2500)
await page.fill('input[placeholder*="加工单号 / 行号"]', 'GD-2026-11-0012 1号车间')
await sleep(1500)
const rows = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll('.sb-block')]
  return [...blocks[1].querySelectorAll('.el-table__body tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120))
})
console.log('block2 rows=' + JSON.stringify(rows))
await page.evaluate(() => {
  const blocks = [...document.querySelectorAll('.sb-block')]
  const tr = [...blocks[1].querySelectorAll('.el-table__body tr')].find((x) => (x.textContent || '').includes('GD-2026-11-0012'))
  if (tr) tr.click()
})
await sleep(900)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '预排线')
  if (b) b.click()
})
await sleep(3500)
const readDialog = () => page.evaluate(() => {
  const d = document.querySelector('.el-dialog')
  if (!d) return { open: false }
  return {
    open: true,
    rows: [...d.querySelectorAll('.el-table__body tr')].map((tr) => ({
      text: (tr.textContent || '').replace(/\s+/g, ' ').trim(),
      inputs: [...tr.querySelectorAll('input')].map((i) => i.value),
    })),
    foot: [...d.querySelectorAll('.el-dialog__footer button')].map((b) => (b.textContent || '').trim()),
  }
})
console.log('before save=' + JSON.stringify(await readDialog(), null, 2))
// 保存(改线模式按钮=保存预排线)
await page.evaluate(() => {
  const d = document.querySelector('.el-dialog')
  const b = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim().includes('保存预排线'))
  if (b) b.click()
})
await sleep(4000)
const msgs = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()))
console.log('after save messages=' + JSON.stringify(msgs))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await sleep(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-09-round2-save.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
