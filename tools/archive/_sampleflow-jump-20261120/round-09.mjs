// round-09 — 连续两次跳转（都非作废）是否都能定位；页签复用
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('sampleflow jump prod')
const page = await task.newPage()
const probe = () => ({
  url: location.href,
  firstInput: (Array.from(document.querySelectorAll('input')).map((i) => (i.value || '').trim()).filter(Boolean)[0]) || '',
  bodyNo: (() => { const m = document.body.innerText.replace(/\s+/g, ' ').match(/样品单编号[：:]\s*([^\s：:]+)/); return m ? m[1] : '' })(),
  pos: (document.body.innerText.replace(/\s+/g, ' ').match(/第\s*(\d+)\s*\/\s*(\d+)/) || []).slice(1).join('/'),
})
const clickAndBack = async (idx, label) => {
  await page.evaluate(() => { location.hash = '#/rd/sampleFlow' })
  await page.waitForTimeout(1800)
  await page.click('.el-table__row:nth-child(' + idx + ') .sfl-no')
  await page.waitForTimeout(2800)
  console.log(label + ' ' + JSON.stringify(await page.evaluate(probe)))
}
await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4500)
await page.evaluate(() => { location.hash = '#/panelx/list/RD_SAMPLE_EXT' })
await page.waitForTimeout(3000)
console.log('PANEL-OPEN ' + JSON.stringify(await page.evaluate(probe)))
await clickAndBack(1, 'JUMP1-xieqin')
await clickAndBack(8, 'JUMP2-SPW0010')
await clickAndBack(1, 'JUMP3-xieqin-again')
await clickAndBack(3, 'JUMP4-lily')
await page.screenshot({ path: OUT + '/round-09-last.png' })
await task.finish({ keep: [] })
