// round-13: 测试库验证「本线工序行填区间外日期 ⇒ 改的是该工序台账,不是当前工序」
// 场景:装箱2(新厂) 线 GD-2026-11-0012 行3(工单行id=2184);日排产工序键=组装,台账工序=装箱(不一致)
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await page.evaluate(() => { localStorage.clear() })
await page.goto('http://127.0.0.1:8091/#/login', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(2500)
await page.evaluate(() => {
  const sel = [...document.querySelectorAll('.el-select')].find((s) => (s.textContent || '').includes('YINJIA-MES'))
  if (sel) sel.querySelector('.el-select__wrapper').click()
})
await sleep(700)
await page.evaluate(() => {
  const o = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.offsetParent !== null)
    .find((x) => (x.textContent || '').includes('测试库'))
  if (o) o.click()
})
await sleep(500)
await page.fill('input[placeholder="请输入登录账号"]', 'admin')
await page.fill('input[placeholder="请输入登录密码"]', '123456')
await page.click('text="进入系统"')
await sleep(4500)
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(6000)
await page.evaluate(() => {
  const line = [...document.querySelectorAll('.wb-line')].find((el) => (el.textContent || '').includes('装箱2(新厂)'))
  if (line) line.click()
})
await sleep(4500)
const readRow = () => page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
  const tr = [...document.querySelectorAll('.el-table__body tr')].find((x) => (x.textContent || '').includes('GD-2026-11-0012'))
  if (!tr) return null
  const cells = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
  const at = (p) => cells[heads.findIndex((t) => t.startsWith(p))]
  return { 开工: at('开工日期'), 计划完工: at('计划完工日期'), 行: (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) }
})
console.log('before=' + JSON.stringify(await readRow()))
// 直接调保存接口(等价于在 11-23 那格填 100;测试库数据可弃)
const save = await page.evaluate(async () => {
  const t = localStorage.getItem('mes_token')
  const r = await fetch('/api/px/scheduleBoard/dayPlan/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
    body: JSON.stringify({ rows: [{ 工单行id: 2184, 工序: '组装', 生产线: '装箱2(新厂)', 计划日期: '2026-11-23', 计划数量: 100 }] }),
  })
  return { status: r.status, body: await r.json() }
})
console.log('save=' + JSON.stringify(save).slice(0, 800))
await sleep(500)
// 重新点线刷新
await page.evaluate(() => {
  const line = [...document.querySelectorAll('.wb-line')].find((el) => (el.textContent || '').includes('装箱2(新厂)'))
  if (line) line.click()
})
await sleep(4500)
console.log('after=' + JSON.stringify(await readRow()))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await sleep(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-13-op-ledger-extend.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
