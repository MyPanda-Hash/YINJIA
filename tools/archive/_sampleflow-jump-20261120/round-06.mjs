// round-06 — 真实用户流:先打开过样品单面板页签（keep-alive），再回样品进度跟踪点行
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('sampleflow jump prod')
const page = await task.newPage()

const probe = () => ({
  url: location.href,
  hashTabs: Array.from(document.querySelectorAll('.tabs-bar__item, .tab-item, .tabs .tab')).map((e) => e.innerText.replace(/\s+/g, ' ').trim()).slice(0, 8),
  firstInput: (Array.from(document.querySelectorAll('input')).map((i) => (i.value || '').trim()).filter(Boolean)[0]) || '',
  bodyNo: (() => { const m = document.body.innerText.replace(/\s+/g, ' ').match(/样品单编号[：:]\s*([^\s：:]+)/); return m ? m[1] : '' })(),
  pos: (document.body.innerText.replace(/\s+/g, ' ').match(/第\s*(\d+)\s*\/\s*(\d+)/) || []).slice(1).join('/'),
})

await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4500)
// SPA 内导航:模拟先点开过样品单面板页签
await page.evaluate(() => { location.hash = '#/panelx/list/RD_SAMPLE_EXT' })
await page.waitForTimeout(4500)
console.log('PANEL-OPENED ' + JSON.stringify(await page.evaluate(probe), null, 2))
// 回样品进度跟踪（页签仍留存在内存）
await page.evaluate(() => { location.hash = '#/rd/sampleFlow' })
await page.waitForTimeout(2500)
console.log('BACK-TO-FLOW url=' + (await page.url()))

// 点非作废单 xieqin（第 3 行）
await page.click('.el-table__row:nth-child(3) .sfl-no')
await page.waitForTimeout(3000)
console.log('AFTER-CLICK-xieqin ' + JSON.stringify(await page.evaluate(probe), null, 2))
await page.screenshot({ path: OUT + '/round-06-after-click-xieqin-tabreuse.png' })

// 回样品进度跟踪，点作废单 admin-01（第 5 行）
await page.evaluate(() => { location.hash = '#/rd/sampleFlow' })
await page.waitForTimeout(2500)
await page.click('.el-table__row:nth-child(5) .sfl-no')
await page.waitForTimeout(3000)
console.log('AFTER-CLICK-admin01 ' + JSON.stringify(await page.evaluate(probe), null, 2))
await page.screenshot({ path: OUT + '/round-06-after-click-admin01-tabreuse.png' })
await task.finish({ keep: [] })
