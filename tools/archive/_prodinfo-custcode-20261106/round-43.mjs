const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.goto(BASE + '/#/panelx/list/RD_SPEC_DOC', { timeout: 60000 })
await page.waitForTimeout(10000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
const tab = await page.evaluate(() => {
  const t = [...document.querySelectorAll('[class*="page-tab"]')].find((e) => (e.textContent || '').includes('检验项目及标准'))
  if (!t) return 'NO_TAB'
  t.click(); return 'OK'
})
console.log('tab =', tab)
await page.waitForTimeout(2500)
const open = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('.rs-lib-btn, .rsp-lib-pick, [class*="lib-btn"]')]
  const el = cands.find((e) => (e.textContent || '').includes('从标准库勾选')) || cands[0]
  if (!el) return 'NO_BTN'
  el.click(); return 'CLICKED'
})
console.log('open =', open)
await page.waitForTimeout(4000)
const dump = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('检验项目标准库')).pop()
  if (!dlg) return { error: 'NO_DIALOG' }
  const groups = [...dlg.querySelectorAll('.lib-group')].map((g, i) => ({
    n: i + 1,
    name: ((g.querySelector('.lib-group-name') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    count: g.querySelectorAll('.lib-sub-name').length,
    first: [...g.querySelectorAll('.lib-sub-name')].slice(0, 2).map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
  }))
  return { count: groups.length, groups }
})
console.log('组数 =', dump.count)
for (const g of dump.groups) console.log(`${g.n}. ${g.name} (${g.count}) :: ${g.first.join(' / ')}`)
const shot = await page.screenshot({ path: '/var/folders/3z/ng8qhxw50j7gg22d5967vt4h0000gn/T/ego-spec-testlib-order/prod-8090-testlib.png' })
console.log('shot =', shot)
