// round-04 — 新标签页直接打开 focus 深链（干净挂载），确认列表页到底定位到哪张单
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const TARGET = 'admin-2026-11-19-01'
const task = await taskSpace('sampleflow jump prod')
const page = await task.newPage()

function probe() {
  const inputs = Array.from(document.querySelectorAll('input')).filter(i => i.value).slice(0, 12).map(i => ({ v: i.value.slice(0, 40), ph: i.placeholder || '' }))
  const rows = Array.from(document.querySelectorAll('.el-table__row')).slice(0, 25).map(r => Array.from(r.cells).map(c => c.innerText.trim()).filter(Boolean).slice(0, 3).join(' | '))
  const selected = Array.from(document.querySelectorAll('[class*="current-row"], [class*="is-selected"], [class*="active-row"], .doc-rail-item.is-active')).slice(0, 5).map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 80))
  return {
    url: location.href,
    inputs,
    rowCount: rows.length,
    rows,
    selected,
    body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 600),
  }
}

await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_EXT?focus=' + encodeURIComponent(TARGET), { timeout: 90000 })
await page.waitForTimeout(6000)
const a = await page.evaluate(probe)
console.log('FRESH-FOCUS ' + TARGET + ' ' + JSON.stringify(a, null, 2))
await page.screenshot({ path: OUT + '/round-04-fresh-focus-' + TARGET + '.png' })

// 再试另一张（第 1 行）作为对照
await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_EXT?focus=xieqin-2026-11-19-01', { timeout: 90000 })
await page.waitForTimeout(6000)
const b = await page.evaluate(probe)
console.log('FRESH-FOCUS xieqin ' + JSON.stringify(b, null, 2))
await page.screenshot({ path: OUT + '/round-04-fresh-focus-xieqin.png' })

await task.finish({ keep: [] })
