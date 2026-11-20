// round-12 — 本地预览(新构建)+ 本机 8090 后端：验证 ?docNo= 定向打开 + 找不到时的兜底
const OUT = '/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/tools/archive/_sampleflow-jump-20261120'
const BASE = 'http://127.0.0.1:4174'
const task = await taskSpace('sampleflow fix local')
const page = task.page('p1')

async function login(user) {
  await page.goto(BASE + '/#/login', { timeout: 90000 })
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
  await page.reload({ timeout: 90000 })
  await page.waitForTimeout(2500)
  await page.fill('.login-form input[autocomplete="username"]', user)
  await page.fill('.login-form input[type="password"]', '123456')
  const sel = await page.evaluate(() => { const el = document.querySelector('.login-form .el-select'); return el ? el.innerText.replace(/\s+/g, ' ').trim() : '' })
  if (!sel || sel.includes('请选择')) { await page.click('.login-form .el-select'); await page.waitForTimeout(500); await page.click('.el-select-dropdown__item'); await page.waitForTimeout(300) }
  await page.click('.login-submit')
  await page.waitForTimeout(5000)
}

const probe = () => ({
  url: location.href,
  firstInput: (Array.from(document.querySelectorAll('input')).map((i) => (i.value || '').trim()).filter(Boolean)[0]) || '',
  bodyNo: (() => { const m = document.body.innerText.replace(/\s+/g, ' ').match(/样品单编号[：:]\s*([^\s：:]+)/); return m ? m[1] : '' })(),
  pos: (document.body.innerText.replace(/\s+/g, ' ').match(/第\s*(\d+)\s*\/\s*(\d+)/) || []).slice(1).join('/'),
  warning: (document.querySelector('.el-message__content') || {}).innerText || '',
})

await login('admin')
await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4000)
const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.sfl-no')).map((a) => a.innerText.trim()))
console.log('FLOW-ROWS(' + rows.length + ') ' + JSON.stringify(rows.slice(0, 6)))

// 点第 3 行（非首行，旧写法会停在第一张）
const target = rows[2]
await page.click('.el-table__row:nth-child(3) .sfl-no')
await page.waitForTimeout(3000)
const after = await page.evaluate(probe)
console.log('AFTER-CLICK target=' + target + ' ' + JSON.stringify(after, null, 2))
await page.screenshot({ path: OUT + '/round-12-local-click-row3.png' })

// 兜底：给一个不存在的单号（模拟已作废/无权限/版本不一致）
await page.goto(BASE + '/#/panelx/list/RD_SAMPLE_EXT?docNo=NO-SUCH-DOC-XYZ', { timeout: 90000 })
await page.waitForTimeout(3500)
const miss = await page.evaluate(probe)
console.log('AFTER-MISSING-DOCNO ' + JSON.stringify(miss, null, 2))
await page.screenshot({ path: OUT + '/round-12-local-missing-docno.png' })

// sampler 本地账号（非管理员、无 view_all）：点不属于自己的单 → 明确提示（新后端部署后该行不会再出现）
await login('sampler')
await page.goto(BASE + '/#/rd/sampleFlow', { timeout: 90000 })
await page.waitForTimeout(4000)
const sRows = await page.evaluate(() => Array.from(document.querySelectorAll('.sfl-no')).map((a) => a.innerText.trim()))
console.log('SAMPLER-FLOW-ROWS(' + sRows.length + ') ' + JSON.stringify(sRows.slice(0, 6)))
// 找第一张不属于 sampler 的单（本地列表 3 张，进度页 11 张；取第 6 行大概率是别人的）
await page.click('.el-table__row:nth-child(6) .sfl-no')
await page.waitForTimeout(3500)
const sAfter = await page.evaluate(probe)
console.log('SAMPLER-AFTER-CLICK ' + JSON.stringify(sAfter, null, 2))
await page.screenshot({ path: OUT + '/round-12-local-sampler-foreign.png' })
await task.finish({ keep: [] })
