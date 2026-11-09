// 第4轮 Round2:正式库/测试库懒切换(token 注入)+ 横向溢出诊断 + 已完成合格绿
const OUT = 'C:/Users/vigna/ego/wo-board-qc-lead-20261109'
const task = await taskSpace('wo-board-qc-lead-20261109')
const page = task.page('p1')
const BASE = 'http://127.0.0.1:8090/api'

async function restoreWindow(p) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function shot(name) {
  await restoreWindow(page)
  console.log('shot:', await page.screenshot({ path: OUT + '/' + name }))
}
async function apiLogin(factory) {
  const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory }) })
  const j = await r.json()
  return j?.data?.token
}
async function useToken(token, label) {
  await page.evaluate((t) => { localStorage.setItem('mes_token', t) }, token)
  await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
  await page.waitForTimeout(4500)
  const h = await page.evaluate(() => location.hash)
  if (String(h).includes('/login')) {
    await page.reload({ timeout: 30000 })
    await page.waitForTimeout(4000)
  }
  console.log('useToken', label, 'hash=', await page.evaluate(() => location.hash))
}

const tokYJ = await apiLogin('YJ')
const tokTest = await apiLogin('YJ_TEST')
console.log('tokens:', tokYJ ? 'YJ ok' : 'YJ fail', tokTest ? 'TEST ok' : 'TEST fail')

// ---------- ① 正式库看板 ----------
await useToken(tokYJ, 'YJ')
await page.evaluate(() => { localStorage.setItem('mes_locale', 'zh-CN') })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)
await shot('round-02-yj-board.png')
const yj = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const r0 = rows[0]
  // 溢出诊断:找出比视口宽的元素(排除 svg 等)
  const over = []
  document.querySelectorAll('.wpb-page, .wpb-grid, .wpb-grid-body, .wpb-screen, .wpb-toolbar, .wpb-stats, body, html').forEach((el) => {
    const r = el.getBoundingClientRect()
    over.push({ cls: el.className || el.tagName, cw: el.clientWidth, sw: el.scrollWidth, rectW: Math.round(r.width), rectR: Math.round(r.right) })
  })
  return {
    hash: location.hash,
    viewport: [window.innerWidth, window.innerHeight],
    doc: { client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth },
    rows: rows.length,
    firstRow: r0 ? txt(r0).slice(0, 420) : '',
    badges: r0 ? [...r0.querySelectorAll('[class*="ins-"]')].map((b) => ({ cls: b.className, text: txt(b) })) : [],
    qcHint: r0 ? txt(r0.querySelector('[class*="wpb-qc-hint"]')) : '',
    stats: [...document.querySelectorAll('.wpb-stat')].map(txt),
    overflowEls: over.filter((o) => o.sw > o.cw + 1 || o.rectR > window.innerWidth + 1),
  }
})
console.log('YJ_BOARD:', JSON.stringify(yj, null, 2))

// 已完工视图:合格行生产状态 tag 颜色
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
await shot('round-02-yj-done.png')
const yjDone = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const r0 = rows[0]
  const tag = r0 ? r0.querySelector('.wpb-status') : null
  const qcTags = r0 ? [...r0.querySelectorAll('[class*="qc"]')].map((b) => ({ cls: b.className, text: txt(b) })) : []
  const cs = tag ? getComputedStyle(tag) : null
  return {
    rows: rows.length,
    firstRowText: r0 ? txt(r0).slice(0, 360) : '',
    statusTag: tag ? { cls: tag.className, text: txt(tag), color: cs.color, bg: cs.backgroundColor, border: cs.borderColor } : null,
    qcTags,
    stats: [...document.querySelectorAll('.wpb-stat')].map(txt),
  }
})
console.log('YJ_DONE:', JSON.stringify(yjDone, null, 2))

// ---------- ② 测试库看板 ----------
await useToken(tokTest, 'TEST')
await page.evaluate(() => { localStorage.setItem('mes_locale', 'zh-CN') })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)
await shot('round-02-test-board.png')
const test = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  return { hash: location.hash, rows: rows.length, firstRow: rows.length ? txt(rows[0]).slice(0, 300) : '', bodyHead: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260) }
})
console.log('TEST_BOARD:', JSON.stringify(test, null, 2))
console.log('ROUND2_DONE')
