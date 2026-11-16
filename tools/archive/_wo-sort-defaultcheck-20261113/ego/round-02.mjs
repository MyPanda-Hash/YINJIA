// 5173(源码即时版)+8090(新 jar)只读走查：列表排序/转单时间 + 点「排产」默认勾选；不保存任何单据
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-sort-defaultcheck-20261113')
const t = entry ? await taskSpace(entry.id) : await taskSpace('wo-sort-defaultcheck-20261113')
const page = (await t.pages())[0] ?? (await t.newPage())
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)

await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(3000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await t.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await sleep(400)
} catch {}
// 会话过期则自动登录
if ((await page.url()).includes('/login')) {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    btn?.click()
  })
  await sleep(3000)
  await page.goto('http://localhost:5173/#/prod/plan/workOrderList', { timeout: 30000 })
  await sleep(4000)
}

const head = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').trim())
  const idx = (n) => ths.indexOf(n)
  return [...document.querySelectorAll('.wol-table .el-table__body tr')].slice(0, 6).map((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
    return { 工单号: tds[idx('工单号')], 单据日期: tds[idx('工单日期')], 转单时间: tds[idx('转单时间')], 状态: tds[idx('生产状态')] }
  })
})
console.log('列表前 6 行=' + JSON.stringify(head, null, 1))

// 搜一张未排产单（GD-2026-11-0018），点行 → 排产 → 断言①池默认勾选，然后关闭弹窗（不保存）
await page.evaluate(() => {
  const inp = document.querySelector('input[placeholder="输入查询条件..."]')
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, 'GD-2026-11-0018'); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }))
})
await sleep(300)
await page.evaluate(() => [...document.querySelectorAll('.wol-query button')].find((b) => (b.textContent || '').trim() === '查找')?.click())
await sleep(3000)
const target = await page.evaluate(() => {
  const tr = document.querySelector('.wol-table .el-table__body tr')
  if (!tr) return null
  const ths = [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').trim())
  const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
  return { 工单号: tds[ths.indexOf('工单号')], 状态: tds[ths.indexOf('生产状态')], 线: tds[ths.indexOf('生产线')] }
})
console.log('目标行=' + JSON.stringify(target))
await page.evaluate(() => document.querySelector('.wol-table .el-table__body tr td')?.click())
await sleep(700)
await page.evaluate(() => [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '排产')?.click())
await page.waitForSelector('.sb-page', { state: 'visible', timeout: 15000 })
await sleep(3500)
const pool = await page.evaluate(() => {
  const first = document.querySelector('.sb-block')
  const rows = first ? [...first.querySelectorAll('.el-table__body tr')] : []
  return {
    rowCount: rows.length,
    checkedCount: rows.filter((tr) => tr.querySelector('.el-checkbox.is-checked')).length,
    firstText: rows[0] ? (rows[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) : '',
    scheduleBtnDisabled: (() => { const b = [...document.querySelectorAll('.sb-bar button')].find((x) => (x.textContent || '').trim() === '排产'); return b ? b.disabled : null })(),
  }
})
console.log('① 待排产池=' + JSON.stringify(pool))
const ok = pool.rowCount === 1 && pool.checkedCount === 1 && pool.scheduleBtnDisabled === false
console.log((ok ? 'PASS' : 'FAIL') + '  点排产后默认勾选当前工单行')
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-sort-defaultcheck-20261113/r02-5173-default-checked.png' })
// 关闭弹窗（不保存）
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('快速排产') && x.getBoundingClientRect().width > 100)
  const close = d?.querySelector('.el-dialog__headerbtn')
  close?.click()
})
await sleep(1500)
console.log('pageerrors=' + JSON.stringify(errors))
process.exit(ok && errors.length === 0 ? 0 : 1)
