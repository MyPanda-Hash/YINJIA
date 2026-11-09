// round-01.mjs — 生产工单页「大日期范围 ⇒ 卡住」基线取证(2026-11-09,只读查询)
// 目标:量出改前:①日期范围拉大后请求+渲染的总耗时 ②长任务分布 ③渲染的行/单元格/日期列数量 ④截图
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-daterange-perf-20261109'
await fs.mkdir(OUT, { recursive: true })

const URL = 'http://localhost:5173/#/prod/plan/workOrderList'
const task = await taskSpace('wo-daterange-perf-20261109')
const page = task.page('p1')
console.log('spaceId=' + task.spaceId)

await page.goto(URL, { timeout: 40000 })
await page.waitForTimeout(4000)


async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(600)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

const loginInfo = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('input')]
  return {
    hash: location.hash,
    inputs: ins.map((i) => i.placeholder || '').slice(0, 6),
    hasLoginBtn: [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes('进入系统')),
  }
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
  await page.goto(URL, { timeout: 40000 })
  await page.waitForTimeout(5000)
}

// ── 改前状态:默认 15 天窗口 ──
const before = await page.evaluate(() => {
  const table = document.querySelector('.wol-table')
  const ths = [...document.querySelectorAll('.wol-table .el-table__header th')]
  const rows = document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length
  const dateThs = ths.filter((th) => /dp-col-/.test(th.className)).length
  return { rows, ths: ths.length, dateThs, cells: rows * ths.length }
})
console.log('default-15d state: ' + JSON.stringify(before))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-01-before-15d.png' })

await restoreWindow()
// ── 把日期范围拉大(填 2020-01-01 ~ 2030-12-31 = 等价全量) ──
const dateInputs = await page.evaluate(() => {
  const ins = [...document.querySelectorAll('.wol-query input')]
  return ins.map((i) => ({ ph: i.placeholder, val: i.value }))
})
console.log('date inputs: ' + JSON.stringify(dateInputs))
const ins = await page.evaluate(() => [...document.querySelectorAll('.wol-query input')].length)

for (let i = 0; i < Math.min(2, ins); i++) {
  const sel = `.wol-query input >> nth=${i}`
  await page.fill(sel, '')
  await page.fill(sel, i === 0 ? '2020-01-01' : '2030-12-31')
  await page.press(sel, 'Enter')
  await page.waitForTimeout(300)
}
const vals = await page.evaluate(() => [...document.querySelectorAll('.wol-query input')].map((i) => i.value))
console.log('date inputs after fill: ' + JSON.stringify(vals))

// ── 安装长任务观测,点「查找」,量到渲染稳定 ──
const metrics = await page.evaluate(async () => {
  const later = (ms) => new Promise((r) => setTimeout(r, ms))
  window.__lt = []
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__lt.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) })
    }).observe({ entryTypes: ['longtask'] })
  } catch (e) { /* ignore */ }

  const btns = [...document.querySelectorAll('.wol-query .el-button')]
  const find = btns.find((b) => (b.textContent || '').includes('查找'))
  if (!find) return { error: '查找 button not found', html: document.querySelector('.wol-query')?.innerText }

  const t0 = performance.now()
  find.click()

  // 等:出现 loading 遮罩 → 再等它消失 + 400ms 无长任务 + 行数稳定
  let sawLoading = false
  let lastRows = -1
  let stable = 0
  let finalRows = 0
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    await later(120)
    const mask = document.querySelector('.wol-table .el-loading-mask')
    const loading = mask && getComputedStyle(mask).display !== 'none'
    if (loading) sawLoading = true
    const rows = document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length
    finalRows = rows
    if (rows === lastRows) stable += 1
    else { stable = 0; lastRows = rows }
    const recentLong = window.__lt.some((x) => x.start > performance.now() - 600)
    if (sawLoading && !loading && stable >= 4 && rows > 0 && !recentLong) break
  }
  const elapsed = Math.round(performance.now() - t0)
  const ths = [...document.querySelectorAll('.wol-table .el-table__header th')]
  const lt = window.__lt
  return {
    elapsed,
    sawLoading,
    rows: finalRows,
    ths: ths.length,
    dateThs: ths.filter((th) => /dp-col-/.test(th.className)).length,
    longTasks: lt.length,
    longTaskTotal: lt.reduce((a, b) => a + b.dur, 0),
    longTaskMax: lt.reduce((a, b) => Math.max(a, b.dur), 0),
    longTasksTop: [...lt].sort((a, b) => b.dur - a.dur).slice(0, 8),
    count: (document.querySelector('.wol-count') || {}).innerText,
  }
})
console.log('WIDE-RANGE metrics: ' + JSON.stringify(metrics, null, 2))

// 等一会儿让绘制落定,再给一次「交互响应」实测:点状态筛选「未完工」,量到 DOM 更新
const interact = await page.evaluate(async () => {
  const later = (ms) => new Promise((r) => setTimeout(r, ms))
  window.__lt2 = []
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__lt2.push(Math.round(e.duration)) })
      .observe({ entryTypes: ['longtask'] })
  } catch (e) { /* ignore */ }
  const radios = [...document.querySelectorAll('.wol-line .el-radio-button')]
  const target = radios.find((r) => (r.innerText || '').includes('未完工'))
  if (!target) return { error: 'radio not found', radios: radios.map((r) => r.innerText) }
  const t0 = performance.now()
  target.querySelector('input')?.click?.() || target.click()
  await later(1500)
  return { elapsed: Math.round(performance.now() - t0), longTasks: window.__lt2.length, longTaskTotal: window.__lt2.reduce((a, b) => a + b, 0), longTaskMax: window.__lt2.reduce((a, b) => Math.max(a, b), 0) }
})
console.log('INTERACTION metrics: ' + JSON.stringify(interact))

const afterState = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.wol-table .el-table__header th')]
  const rows = document.querySelectorAll('.wol-table .el-table__body-wrapper tbody tr').length
  return { rows, ths: ths.length, dateThs: ths.filter((th) => /dp-col-/.test(th.className)).length, count: (document.querySelector('.wol-count') || {}).innerText }
})
console.log('after state: ' + JSON.stringify(afterState))

// 截图前恢复窗口
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(600)
} catch (e) { console.log('restore skip: ' + e.message) }

await page.screenshot({ path: OUT + '/round-01-before-wide.png' })
console.log('screenshot saved to ' + OUT)
