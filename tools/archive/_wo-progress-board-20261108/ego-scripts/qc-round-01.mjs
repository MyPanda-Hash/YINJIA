// 第4轮 E2E:看板检验徽标/待品质检验提示/完工合格绿/NG红(测试账套造数)+ 9090/5173
const OUT = 'C:/Users/vigna/ego/wo-board-qc-lead-20261109'
const task = await taskSpace('wo-board-qc-lead-20261109')
const page = task.page('p1')

async function restoreWindow(p) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function shot(name) {
  await restoreWindow(page)
  console.log('shot:', await page.screenshot({ path: OUT + '/' + name }))
}
async function autoLogin() {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4500)
}
async function loginFactory(factory) {
  // 退出登录 → 选工厂登录(正式库 YJ / 测试库 YJ_TEST)
  await page.evaluate(() => {
    try { localStorage.removeItem('mes_token') } catch (e) {}
    location.hash = '#/login'
  })
  await page.waitForTimeout(1500)
  const hasLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
  if (!hasLogin) { await page.reload({ timeout: 30000 }); await page.waitForTimeout(2500) }
  const ok = await page.evaluate((f) => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
    // 工厂选择:找 el-select 并点开,选项文本含 YJ_TEST 的选它
    const sel = document.querySelector('.el-select')
    if (sel) sel.click()
    return { hasSel: !!sel }
  }, factory)
  await page.waitForTimeout(800)
  await page.evaluate((f) => {
    const want = f === 'YJ_TEST' ? /测试/ : /YINJIA-MES$/
    const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter((x) => x.offsetParent !== null)
    const hit = items.find((x) => want.test((x.textContent || '').trim())) || items[0]
    if (hit) hit.click()
  }, factory)
  await page.waitForTimeout(400)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4500)
  return page.evaluate(() => location.hash)
}

// ============ ① 正式库 5173:检验徽标/提示/完工合格绿 ============
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(4000)
let hash = await page.evaluate(() => location.hash)
if (String(hash).includes('/login')) { await autoLogin(); await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 }); await page.waitForTimeout(4000) }
await page.evaluate(() => { localStorage.setItem('mes_locale', 'zh-CN') })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)
await shot('round-01-board-qc.png')

const board = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const r0 = rows[0]
  const badges = r0 ? [...r0.querySelectorAll('[class*="ins-"]')].map((b) => ({ cls: b.className, text: txt(b) })) : []
  const rowStatus = r0 ? [...r0.querySelectorAll('.wpb-status')].map((b) => ({ cls: b.className, text: txt(b) })) : []
  const qcHint = r0 ? txt(r0.querySelector('[class*="wpb-qc-hint"]')) : ''
  return {
    rows: rows.length,
    firstRow: r0 ? txt(r0).slice(0, 500) : '',
    badges,
    rowStatus,
    qcHint,
    stats: [...document.querySelectorAll('.wpb-stat')].map(txt),
    noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  }
})
console.log('BOARD_QC:', JSON.stringify(board, null, 2))

// 已完工视图(合格绿)
await page.evaluate(() => {
  const sel = document.querySelectorAll('.wpb-toolbar .el-select')[0]
  const w = sel?.querySelector('.el-select__wrapper') || sel?.querySelector('.el-input__wrapper') || sel
  if (w) w.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-select-dropdown__item')].find((x) => (x.textContent || '').trim() === '已完工' && x.offsetParent !== null)
  if (it) it.click()
})
await page.waitForTimeout(2500)
await shot('round-01-board-done.png')
const done = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const r0 = rows[0]
  const tag = r0 ? r0.querySelector('.wpb-status') : null
  const cs = tag ? getComputedStyle(tag) : null
  const qcTag = r0 ? [...r0.querySelectorAll('[class*="wpb-qc-tag"]')].map((b) => ({ cls: b.className, text: txt(b) })) : []
  return {
    rows: rows.length,
    firstRowText: r0 ? txt(r0).slice(0, 300) : '',
    statusTag: tag ? { cls: tag.className, text: txt(tag), color: cs.color, bg: cs.backgroundColor, border: cs.borderColor } : null,
    qcTags: qcTag,
  }
})
console.log('DONE_VIEW:', JSON.stringify(done, null, 2))

// 切回未完工
await page.evaluate(() => {
  const sel = document.querySelectorAll('.wpb-toolbar .el-select')[0]
  const w = sel?.querySelector('.el-select__wrapper') || sel?.querySelector('.el-input__wrapper') || sel
  if (w) w.click()
})
await page.waitForTimeout(600)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-select-dropdown__item')].find((x) => (x.textContent || '').trim() === '未完工' && x.offsetParent !== null)
  if (it) it.click()
})
await page.waitForTimeout(2000)

// ============ ② 测试账套:GG 红色路径(测试库造 NG 数据) ============
// 切测试工厂(重新登录 YJ_TEST)
const testHash = await loginFactory('YJ_TEST')
console.log('after login YJ_TEST hash =', testHash)
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(4000)
await page.evaluate(() => { localStorage.setItem('mes_locale', 'zh-CN') })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)
const testBoard = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  return { rows: rows.length, body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 400), firstRow: rows.length ? txt(rows[0]).slice(0, 300) : '' }
})
console.log('TEST_BOARD:', JSON.stringify(testBoard, null, 2))
await shot('round-02-test-board.png')
console.log('ROUND_DONE')
