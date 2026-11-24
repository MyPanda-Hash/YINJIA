// round-04: 仪器使用汇总表改选「全部」再查询(「全部」是 radio-button 的 label,不是 button)
const task = await taskSpace('deploy-smoke-20261124')
const page = task.page('p1')
const OUT = 'C:/Users/vigna/ego/deploy-smoke-20261124/'
const BASE = 'http://36.140.66.163:8090/'

await page.goto(BASE + '#/rd/instrSummary', { timeout: 30000 })
await page.waitForTimeout(4000)

// 打印过滤区可点元素,确认「全部」挂在哪个节点
const opts = await page.evaluate(() =>
  [...document.querySelectorAll('.el-radio-button, .el-radio, label, span, button')]
    .filter((e) => ['今天', '本周', '本月', '上月', '全部'].includes((e.textContent || '').trim()))
    .map((e) => ({ cls: e.className, tag: e.tagName, txt: (e.textContent || '').trim() })))
console.log('FILTER_OPTS ' + JSON.stringify(opts.slice(0, 10)))

const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.el-radio-button, .el-radio, label')]
    .find((e) => (e.textContent || '').trim() === '全部')
  if (!el) return 'not-found'
  el.click()
  const q = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查询')
  if (q) q.click()
  return 'clicked'
})
console.log('CLICK ' + clicked)
await page.waitForTimeout(6000)

const r = await page.evaluate(() => ({
  rows: document.querySelectorAll('.el-table__row').length,
  active: [...document.querySelectorAll('.el-radio-button.is-active, .el-radio.is-checked')].map((e) => (e.textContent || '').trim()),
  range: ((document.body.innerText || '').match(/当前时间范围内[^\n]*/) || [''])[0],
  stats: (document.body.innerText || '').replace(/\s+/g, ' ').match(/记录条数\s*\d+\s*涉及仪器\s*\d+\s*使用人数\s*\d+\s*涉及项目\s*\d+/)?.[0] || '',
}))
console.log('INSTR_ALL ' + JSON.stringify(r))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '05-instr-summary-all.png' })
