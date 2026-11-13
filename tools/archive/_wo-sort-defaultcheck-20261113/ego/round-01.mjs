// 2026-11-13 需求 2 验收：生产工单点「排产」→ 内嵌快速排产 → ①待排产池**默认勾选**当前工单行
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-sort-defaultcheck-20261113')
const t = entry ? await taskSpace(entry.id) : await taskSpace('wo-sort-defaultcheck-20261113')
const page = (await t.pages())[0] ?? (await t.newPage())
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)

await page.goto('http://127.0.0.1:8091/#/login', { timeout: 30000 })
await sleep(1500)
// 登录（admin/123456，工厂 YJ=本实例主库=测试库）
let logged = !(await page.url()).includes('/login')
for (let i = 0; i < 2 && !logged; i++) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await sleep(2500)
  logged = !(await page.url()).includes('/login')
}
console.log('logged=' + logged)
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await t.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await sleep(500)
} catch {}

// 列表头两行（新单应在上）—— 记录顺序与转单时间
const head = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').trim())
  const idx = (name) => ths.indexOf(name)
  return [...document.querySelectorAll('.wol-table .el-table__body tr')].slice(0, 5).map((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
    return { 工单号: tds[idx('工单号')], 单据日期: tds[idx('工单日期')], 转单时间: tds[idx('转单时间')], 物料编码: tds[idx('物料编码')] }
  })
})
console.log('列表前 5 行=' + JSON.stringify(head, null, 1))

// 点第 1 行（当前行）→ 点「排产」
await page.evaluate(() => {
  const tr = document.querySelector('.wol-table .el-table__body tr')
  tr?.querySelector('td')?.click()
})
await sleep(800)
const targetNo = await page.evaluate(() => {
  const tr = document.querySelector('.wol-table .el-table__body tr')
  const ths = [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').trim())
  const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
  return tds[ths.indexOf('工单号')]
})
console.log('目标工单=' + targetNo)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '排产')
  btn?.click()
})
await page.waitForSelector('.sb-page', { state: 'visible', timeout: 15000 })
await sleep(3500)

const pool = await page.evaluate(() => {
  const blocks = [...document.querySelectorAll('.sb-block')]
  const first = blocks[0]
  if (!first) return null
  const rows = [...first.querySelectorAll('.el-table__body tr')]
  return {
    rowCount: rows.length,
    checkedCount: rows.filter((tr) => tr.querySelector('.el-checkbox.is-checked')).length,
    firstText: rows[0] ? (rows[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160) : '',
    firstChecked: rows[0] ? !!rows[0].querySelector('.el-checkbox.is-checked') : false,
    buttons: [...document.querySelectorAll('.sb-bar button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
    scheduleBtnDisabled: (() => {
      const b = [...document.querySelectorAll('.sb-bar button')].find((x) => (x.textContent || '').trim() === '排产')
      return b ? b.disabled : null
    })(),
  }
})
console.log('① 待排产池=' + JSON.stringify(pool, null, 1))
const ok = pool && pool.rowCount === 1 && pool.checkedCount === 1 && pool.firstChecked === true && pool.scheduleBtnDisabled === false
console.log((ok ? 'PASS' : 'FAIL') + '  点排产后默认勾选当前工单行(①池 1 行/勾 1 行/排产按钮可用)')
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-sort-defaultcheck-20261113/r01-schedule-default-checked.png' })
console.log('pageerrors=' + JSON.stringify(errors))
process.exit(ok ? 0 : 1)
