// round-10 — 真实报障账号（谢琴 xieqin，非管理员/无 view_all）：样品进度 17 行 → 点别人的单
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://36.140.66.163:8090'
const task = await taskSpace('sampleflow jump prod')
const page = await task.newPage()

const probe = () => ({
  url: location.href,
  user: (() => { try { return JSON.parse(localStorage.getItem('mes_user') || 'null')?.userName || '' } catch (e) { return '' } })(),
  firstInput: (Array.from(document.querySelectorAll('input')).map((i) => (i.value || '').trim()).filter(Boolean)[0]) || '',
  bodyNo: (() => { const m = document.body.innerText.replace(/\s+/g, ' ').match(/样品单编号[：:]\s*([^\s：:]+)/); return m ? m[1] : '' })(),
  pos: (document.body.innerText.replace(/\s+/g, ' ').match(/第\s*(\d+)\s*\/\s*(\d+)/) || []).slice(1).join('/'),
  denied: document.body.innerText.includes('没有查看样品进度数据的权限'),
})

// 退出登录 → xieqin 登录
await page.goto(BASE + '/#/login', { timeout: 90000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.reload({ timeout: 90000 })
await page.waitForTimeout(3000)
await page.fill('.login-form input[autocomplete="username"]', 'xieqin')
await page.fill('.login-form input[type="password"]', '123456')
const sel = await page.evaluate(() => { const el = document.querySelector('.login-form .el-select'); return el ? el.innerText.replace(/\s+/g, ' ').trim() : '' })
if (!sel || sel.includes('请选择')) { await page.click('.login-form .el-select'); await page.waitForTimeout(400); await page.click('.el-select-dropdown__item'); await page.waitForTimeout(300) }
await page.click('.login-submit')
await page.waitForTimeout(5000)
console.log('LOGIN ' + JSON.stringify(await page.evaluate(() => ({ url: location.href, body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 120) }))))

await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4500)
const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.sfl-no')).map((a) => a.innerText.trim()))
console.log('FLOW-ROWS(' + rows.length + ') ' + JSON.stringify(rows))
await page.screenshot({ path: OUT + '/round-10-xieqin-flow.png' })

// 点第 2 行（liulei 的单，不属于谢琴）
await page.click('.el-table__row:nth-child(2) .sfl-no')
await page.waitForTimeout(3500)
console.log('CLICK-row2 ' + JSON.stringify(await page.evaluate(probe), null, 2))
await page.screenshot({ path: OUT + '/round-10-xieqin-click-row2.png' })

// 回跟踪页点自己那张（第 1 行）
await page.evaluate(() => { location.hash = '#/rd/sampleFlow' })
await page.waitForTimeout(2000)
await page.click('.el-table__row:nth-child(1) .sfl-no')
await page.waitForTimeout(3500)
console.log('CLICK-row1-own ' + JSON.stringify(await page.evaluate(probe), null, 2))
await page.screenshot({ path: OUT + '/round-10-xieqin-click-row1.png' })
await task.finish({ keep: [] })
