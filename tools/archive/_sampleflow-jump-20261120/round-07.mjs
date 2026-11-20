// round-07 — 页签已开时点第 1 行(xieqin) + 切到非开发样品单面板点行
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('sampleflow jump prod')
const page = await task.newPage()

const probe = () => ({
  url: location.href,
  firstInput: (Array.from(document.querySelectorAll('input')).map((i) => (i.value || '').trim()).filter(Boolean)[0]) || '',
  bodyNo: (() => { const m = document.body.innerText.replace(/\s+/g, ' ').match(/样品单编号[：:]\s*([^\s：:]+)/); return m ? m[1] : '' })(),
  pos: (document.body.innerText.replace(/\s+/g, ' ').match(/第\s*(\d+)\s*\/\s*(\d+)/) || []).slice(1).join('/'),
  body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 220),
})

await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4500)
// 先开过面板页签
await page.evaluate(() => { location.hash = '#/panelx/list/RD_SAMPLE_EXT' })
await page.waitForTimeout(3500)
console.log('PANEL-OPENED ' + JSON.stringify(await page.evaluate(probe)))

// 回跟踪页点第 1 行 xieqin
await page.evaluate(() => { location.hash = '#/rd/sampleFlow' })
await page.waitForTimeout(2000)
await page.click('.el-table__row:nth-child(1) .sfl-no')
await page.waitForTimeout(3000)
console.log('AFTER-CLICK-xieqin ' + JSON.stringify(await page.evaluate(probe), null, 2))
await page.screenshot({ path: OUT + '/round-07-xieqin-tabreuse.png' })

// 切到非开发样品单 tab，点它的唯一一行
await page.evaluate(() => { location.hash = '#/rd/sampleFlow' })
await page.waitForTimeout(2000)
const ndBtn = await page.evaluate(() => {
  const labels = Array.from(document.querySelectorAll('.el-radio-button__inner')).map((e) => e.innerText.trim())
  return labels
})
console.log('panel switch labels: ' + JSON.stringify(ndBtn))
await page.click('text=外部-非开发样品单')
await page.waitForTimeout(3000)
const ndList = await page.evaluate(() => ({ rows: document.querySelectorAll('.el-table__row').length, first: (document.querySelector('.el-table__row') || {}).innerText }))
console.log('ND-ROWS ' + JSON.stringify(ndList))
await page.click('.el-table__row:nth-child(1) .sfl-no')
await page.waitForTimeout(3500)
console.log('AFTER-CLICK-ND ' + JSON.stringify(await page.evaluate(probe), null, 2))
await page.screenshot({ path: OUT + '/round-07-nd-click.png' })
await task.finish({ keep: [] })
