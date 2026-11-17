// round-01:8091 测试账套 —— 生产工单追溯弹窗「入库单据」按明细行显示多个批次
import { readFileSync } from 'node:fs'
const fixture = JSON.parse(readFileSync('D:/workspace/yinjia/.tmp/fixture-wo.json', 'utf8'))
const WO = fixture.wo
const task = await taskSpace('wo-finishin-multibatch-20261113')
const page = (await task.pages())[0] ?? (await task.newPage())
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
await page.goto('http://127.0.0.1:8091/#/login', { timeout: 30000 })
await sleep(1800)
let logged = !(await page.url()).includes('/login')
if (!logged) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin')
    if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    btn?.click()
  })
  await sleep(3500)
  logged = !(await page.url()).includes('/login')
}
console.log('logged=' + logged + ' WO=' + WO)
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(4800)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
// 查询工单
await page.evaluate((wo) => {
  const inp = document.querySelector('input[placeholder="输入查询条件..."]')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, wo)
  inp.dispatchEvent(new Event('input', { bubbles: true }))
}, WO)
await sleep(300)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-query button')].find((b) => (b.textContent || '').trim() === '查找')
  btn?.click()
})
await sleep(3200)
// 选中当前行(点工单号链接或行)
await page.evaluate(() => {
  const tr = document.querySelector('.wol-table .el-table__body tr')
  tr?.querySelector('td .el-checkbox')?.click()
  tr?.click()
})
await sleep(800)
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button, button')].find((b) => (b.textContent || '').trim() === '追溯')
  if (!btn) return false
  btn.click()
  return true
})
console.log('traceBtn=' + clicked)
await sleep(3800)
const trace = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll('.wb-trace-block')]
  const block = blocks.find((b) => (b.textContent || '').includes('入库单据'))
  if (!block) return null
  const table = block.querySelector('.el-table')
  const ths = [...(table?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.textContent || '').trim())
  const rows = [...(table?.querySelectorAll('.el-table__body tr') || [])].map((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
    const o = {}
    ths.forEach((h, i) => { if (h) o[h] = tds[i] })
    return o
  })
  return { title: (block.querySelector('.wb-block-title') || {}).textContent?.replace(/\s+/g, ' ').trim(), ths, rows }
})
console.log('入库单据=' + JSON.stringify(trace, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-finishin-multibatch-20261113/r01-trace-batches.png' })
// 同时看产成品入库单列表(应有一张草稿)
await page.keyboard.press('Escape')
await sleep(600)
await page.goto('http://127.0.0.1:8091/#/panelx/list/FINISH_IN', { timeout: 30000 })
await sleep(4500)
const panel = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const rows = [...document.querySelectorAll('.el-table__body tr')].slice(0, 3).map((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
    const o = {}
    ths.forEach((h, i) => { if (h) o[h] = tds[i] })
    return o
  })
  return { ths, rows }
})
console.log('FINISH_IN 列表=' + JSON.stringify(panel, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-finishin-multibatch-20261113/r01-finish-in-list.png' })
console.log('pageerrors=' + JSON.stringify(errors))
