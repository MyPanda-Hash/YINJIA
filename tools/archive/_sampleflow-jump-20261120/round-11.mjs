// round-11 — 探路:?docNo= 对非作废单（超出列表页/他人单）是否可用
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('sampleflow jump prod')
const page = await task.newPage()
const probe = () => ({
  url: location.href,
  firstInput: (Array.from(document.querySelectorAll('input')).map((i) => (i.value || '').trim()).filter(Boolean)[0]) || '',
  bodyNo: (() => { const m = document.body.innerText.replace(/\s+/g, ' ').match(/样品单编号[：:]\s*([^\s：:]+)/); return m ? m[1] : '' })(),
  pos: (document.body.innerText.replace(/\s+/g, ' ').match(/第\s*(\d+)\s*\/\s*(\d+)/) || []).slice(1).join('/'),
  rows: document.querySelectorAll('.el-table__row').length,
})
// 管理员先测 docNo 非作废
await page.goto(BASE + '/#/login', { timeout: 90000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.reload({ timeout: 90000 }); await page.waitForTimeout(2500)
await page.fill('.login-form input[autocomplete="username"]', 'admin')
await page.fill('.login-form input[type="password"]', '123456')
if (!(await page.evaluate(() => document.querySelector('.login-form .el-select')?.innerText.includes('YINJIA')))) {
  await page.click('.login-form .el-select'); await page.waitForTimeout(400); await page.click('.el-select-dropdown__item'); await page.waitForTimeout(300)
}
await page.click('.login-submit'); await page.waitForTimeout(5000)
await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_EXT?docNo=SPW-2026-11-0010', { timeout: 90000 })
await page.waitForTimeout(4500)
console.log('ADMIN-DOCNO-SPW0010 ' + JSON.stringify(await page.evaluate(probe)))
await page.screenshot({ path: OUT + '/round-11-admin-docno-spw0010.png' })

// 页签已开时再 docNo 另一张
await page.evaluate(() => { location.hash = '#/panelx/list/RD_SAMPLE_EXT?docNo=xieqin-2026-11-19-01' })
await page.waitForTimeout(3500)
console.log('ADMIN-DOCNO-XIEQIN-TABREUSE ' + JSON.stringify(await page.evaluate(probe)))
await task.finish({ keep: [] })
