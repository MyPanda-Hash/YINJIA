// round-02: 登录(YINJIA-MES 正式库) → 打开 3 个新面板取证
const task = await taskSpace('deploy-smoke-20261124')
const page = task.page('p1')
const OUT = 'C:/Users/vigna/ego/deploy-smoke-20261124/'
const BASE = 'http://36.140.66.163:8090/'

async function normalWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

async function shot(name) {
  await normalWindow()
  await page.screenshot({ path: OUT + name })
}

await page.goto(BASE + '#/login', { timeout: 30000 })
await page.waitForTimeout(2500)

// 登录:账号 admin / 密码 123456,登录工厂保持 YINJIA-MES(正式库)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
  setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(6000)
console.log('LOGIN hash=' + (await page.evaluate(() => location.hash)))

// ① 仪器使用汇总表(新页面 + 新后端 InstrSummaryController)
await page.goto(BASE + '#/rd/instrSummary', { timeout: 30000 })
await page.waitForTimeout(6000)
const r1 = await page.evaluate(() => ({
  hash: location.hash,
  title: (document.querySelector('.page-title, .el-page-header__content, h2, h3') || {}).textContent || '',
  rows: document.querySelectorAll('.el-table__row').length,
  head: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 260),
}))
console.log('INSTR_SUMMARY ' + JSON.stringify(r1))
await shot('01-instr-summary.png')

// ② 不合格品处理单(成品) —— 新表 qc_bhc_cp
await page.goto(BASE + '#/panelx/list/QC_BHCP', { timeout: 30000 })
await page.waitForTimeout(5000)
const r2 = await page.evaluate(() => ({
  hash: location.hash,
  rows: document.querySelectorAll('.el-table__row').length,
  head: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 220),
}))
console.log('QC_BHCP ' + JSON.stringify(r2))
await shot('02-qc-bhcp.png')

// ③ 送样登记表(内部检测目录) —— 序号应为 1..57 无重号
await page.goto(BASE + '#/panelx/list/SAMPLE_REG', { timeout: 30000 })
await page.waitForTimeout(5000)
const r3 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__row')]
  const nums = rows.map((tr) => {
    const tds = tr.querySelectorAll('td')
    // 序号列通常是第 2 个 td(第 1 个是勾选/展开)
    for (const td of tds) {
      const t = (td.innerText || '').trim()
      if (/^\d{1,2}$/.test(t)) return Number(t)
    }
    return null
  }).filter((n) => n != null)
  const dup = nums.filter((n, i) => nums.indexOf(n) !== i)
  return { hash: location.hash, rows: rows.length, seqCount: nums.length, min: Math.min(...nums), max: Math.max(...nums), dup, first20: nums.slice(0, 20) }
})
console.log('SAMPLE_REG ' + JSON.stringify(r3))
await shot('03-sample-reg.png')
