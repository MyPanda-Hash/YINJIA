// round-01.mjs — 工单排产页冻结列(产品编码/产品规格/订单数量)取证
// 目标:①列头顺序 ②左侧固定列集合 ③横向滚动后固定列仍可读 ④截图
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-board-freeze-20261108'
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')
console.log('spaceId=' + task.spaceId)
await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 40000 })
await page.waitForTimeout(4500)

// 会话过期 → 走登录(账号 admin / 123456,工厂默认 YINJIA-MES 正式库)
const loginInfo = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('input')]
  return { hash: location.hash, inputs: ins.map((i) => i.placeholder || '').slice(0, 6),
           hasLoginBtn: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')) }
})
console.log('login check: ' + JSON.stringify(loginInfo))
if (loginInfo.hasLoginBtn) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin')
    if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(5000)
  await page.goto('http://localhost:5173/#/prod/plan/workOrderBoard', { timeout: 40000 })
  await page.waitForTimeout(4000)
}

// 选一条产线(左侧骨架):优先含“3号车间”的行,否则第一条可用线
const picked = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.wb-line')]
  const target = els.find((el) => (el.textContent || '').includes('3号车间')) || els.find((el) => !el.classList.contains('off'))
  if (!target) return null
  const name = (target.querySelector('.wb-line-name') || target).textContent.trim()
  target.click()
  return name
})
console.log('picked line: ' + picked)
await page.waitForTimeout(4500)

const info = await page.evaluate(() => {
  const table = document.querySelector('.wb-block .el-table')
  const ths = [...document.querySelectorAll('.wb-block .el-table__header th')]
  const heads = ths.map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim())
  const fixedLeft = ths
    .map((th, i) => ({ i, t: (th.innerText || '').replace(/\s+/g, ' ').trim(), cls: th.className }))
    .filter((x) => /fixed-column--left/.test(x.cls))
    .map((x) => x.t)
  const fixedRight = ths
    .map((th) => ({ t: (th.innerText || '').replace(/\s+/g, ' ').trim(), cls: th.className }))
    .filter((x) => /fixed-column--right/.test(x.cls))
    .map((x) => x.t)
  const body = table ? table.querySelector('.el-scrollbar__wrap') : null
  const rows = document.querySelectorAll('.wb-block .el-table__body tbody tr').length
  return {
    rowCount: rows,
    headerCount: ths.length,
    heads,
    fixedLeft,
    fixedRight,
    scrollWidth: body ? body.scrollWidth : null,
    clientWidth: body ? body.clientWidth : null,
  }
})
console.log('table layout: ' + JSON.stringify(info, null, 2))

// 横向滚动到最右(看冻结列是否一直可读)
const scrolled = await page.evaluate(() => {
  const wraps = [...document.querySelectorAll('.wb-block .el-scrollbar__wrap')]
  const w = wraps.find((el) => el.scrollWidth > el.clientWidth + 10) || wraps[0]
  if (!w) return null
  w.scrollLeft = w.scrollWidth
  w.dispatchEvent(new Event('scroll', { bubbles: true }))
  return { left: w.scrollLeft, mode: 'wrap' }
})
console.log('scrolled: ' + JSON.stringify(scrolled))
await page.waitForTimeout(1200)
const afterScroll = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.wb-block .el-table__header th')]
  const fixedLeft = ths
    .map((th) => ({ t: (th.innerText || '').replace(/\s+/g, ' ').trim(), cls: th.className, x: th.getBoundingClientRect().x }))
    .filter((x) => /fixed-column--left/.test(x.cls))
    .map((x) => x.t + '@' + Math.round(x.x))
  return { fixedLeft }
})
console.log('after scroll fixed left: ' + JSON.stringify(afterScroll))

// 截图前恢复窗口
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
} catch (e) { console.log('restore skip: ' + e.message) }

await page.screenshot({ path: OUT + '/round-01-scrolled.png' })
// 回到最左再截一张
await page.evaluate(() => {
  const wraps = [...document.querySelectorAll('.wb-block .el-scrollbar__wrap')]
  const w = wraps.find((el) => el.scrollWidth > el.clientWidth + 10) || wraps[0]
  if (w) { w.scrollLeft = 0; w.dispatchEvent(new Event('scroll', { bubbles: true })) }
})
await page.waitForTimeout(1000)
await page.screenshot({ path: OUT + '/round-01-left.png' })
console.log('screenshots saved to ' + OUT)
