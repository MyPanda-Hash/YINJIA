// round-32 — 8090:真实点击切到测试库 → 巡线纸面 12 列 × 3 块(打开 XJ-2026-11-0003)
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}
await page.goto('http://127.0.0.1:8090/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(7000)
let factory = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
console.log('FACTORY0=' + factory)
if (!/测试/.test(factory)) {
  try { await page.click('.topbar .factory:not(.locale-switch)', { label: '账套下拉' }) } catch (e) { console.log('click err ' + e.message) }
  await page.waitForTimeout(1500)
  const items = await page.evaluate(() => {
    const its = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
    return its.map((e, i) => ({ i, t: (e.textContent || '').replace(/\s+/g, ' ').trim() }))
  })
  console.log('ITEMS=' + JSON.stringify(items))
  const marked = await page.evaluate(() => {
    const its = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
    const t = its.find((e) => /测试/.test((e.textContent || '')))
    if (!t) return false
    t.id = 'pick-test-factory'
    return true
  })
  console.log('MARKED=' + marked)
  if (marked) {
    try { await page.click('#pick-test-factory', { label: '测试库' }) } catch (e) { console.log('pick err ' + e.message) }
  }
  await page.waitForTimeout(2500)
  const dlgInfo = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
    if (!d) return { open: false }
    const inp = d.querySelector('input')
    if (inp) inp.id = 'fs-pwd'
    const btns = [...d.querySelectorAll('button')]
    const sub = btns.find((b) => (b.textContent || '').includes('切换并重新登录'))
    if (sub) sub.id = 'fs-submit'
    return { open: true, title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(), btns: btns.map((b) => (b.textContent || '').trim()) }
  })
  console.log('DLG=' + JSON.stringify(dlgInfo))
  if (dlgInfo.open) {
    try { await page.fill('#fs-pwd', '123456') } catch (e) { console.log('fill err ' + e.message) }
    await page.waitForTimeout(400)
    try { await page.click('#fs-submit', { label: '切换并重新登录' }) } catch (e) { console.log('submit err ' + e.message) }
    await page.waitForTimeout(14000)
  }
}
factory = await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim())
console.log('FACTORY1=' + factory)

// 直接进巡线面板并开单
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(8000)
const rail = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return { rows: [...document.querySelectorAll('.dsr-grid tbody tr')].slice(0, 5).map((x) => txt(x)) }
})
console.log('RAIL=' + JSON.stringify(rail))
const ok = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const tr = [...document.querySelectorAll('.dsr-grid tbody tr')].find((x) => txt(x).includes('XJ-2026-11-0003'))
  if (tr) tr.click()
  return !!tr
})
console.log('OPEN_DOC=' + ok)
await page.waitForTimeout(8000)
const paper = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const ths = [...document.querySelectorAll('.lp-grid thead th')].map((e) => txt(e))
  const get = (sel) => { const c = document.querySelector(sel); if (!c) return null; const i = c.querySelector('input'); return i ? i.value : txt(c) }
  return {
    sheet: !!document.querySelector('.lp-sheet'),
    title: txt(document.querySelector('.lp-title')),
    headers: ths,
    headerCount: ths.filter((t) => t && t !== '增删').length,
    blocks: document.querySelectorAll('.lp-grid tbody tr.is-block-first').length,
    rows: document.querySelectorAll('.lp-row').length,
    rowspan4: [...document.querySelectorAll('[rowspan="4"]')].length,
    vShift: get('.lp-block[data-lp="巡线时间"]'),
    v1: get('.lp-prod[data-lp="编号1"]'),
    vLen: get('.lp-prod[data-lp="长度实测1"]'),
    vPerson: get('.lp-block[data-lp="巡线人员"]'),
    date: (() => { const i = document.querySelector('.lp-date input'); return i ? i.value : txt(document.querySelector('.lp-date')) })(),
  }
})
console.log('PAPER8090=' + JSON.stringify(paper, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-32-8090-patrol.png', fullPage: true })
await fs.writeFile(OUT + '/b8090-patrol2.json', JSON.stringify({ factory, rail, ok, paper }, null, 1), 'utf8')
console.log('DONE round-32')
