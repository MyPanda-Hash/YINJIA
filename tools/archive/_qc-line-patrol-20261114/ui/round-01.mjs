// round-01 — 巡线检验(QC_LINE_PATROL):菜单入口 / 新建草稿 / 纸面 12 列 × 3 块渲染
// 跑法:ego-browser nodejs -e "await import('file:///C:/Users/vigna/ego/qc-line-patrol-20261114/round-01.mjs')"
const out = 'C:/Users/vigna/ego/qc-line-patrol-20261114'
const task = await taskSpace('qc-line-patrol-20261114')
const page = task.page('p1')

async function loginIfNeeded() {
  const need = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
  if (!need) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(9000)
  return true
}
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip') }
}
const SNAP = () => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => [...document.querySelectorAll(s)]
  return {
    hash: location.hash,
    lang: (() => { try { return localStorage.getItem('mes_locale') } catch (e) { return '' } })(),
    navHasMenu: ((q('.leftnav')?.innerText) || '').includes('巡线检验'),
    navQc: ((q('.leftnav')?.innerText) || '').includes('制程品质'),
    sheet: !!q('.lp-sheet'),
    title: (q('.lp-title')?.textContent || '').trim(),
    dateLabel: (q('.lp-head-left')?.textContent || '').replace(/\s+/g, ' ').trim(),
    auditorLabel: (q('.lp-head-right')?.textContent || '').replace(/\s+/g, ' ').trim(),
    headers: qa('.lp-grid thead th').map((x) => (x.textContent || '').replace(/\s+/g, ' ').trim()),
    headerCount: qa('.lp-grid thead th').length,
    bodyRows: qa('.lp-grid tbody tr').length,
    blockCells: qa('.lp-grid tbody td.lp-block').length,
    rowspanValues: [...new Set(qa('.lp-grid tbody td.lp-block').map((td) => td.getAttribute('rowspan')))],
    prodCells: qa('.lp-grid tbody td.lp-prod').length,
    inputs: qa('.lp-sheet input').length,
    opBtns: qa('.lp-sheet .lp-btn').length,
    sideBtns: qa('.as-side-btn').map((x) => (x.textContent || '').trim()).filter(Boolean),
    emptyHint: (q('.lp-empty')?.textContent || '').replace(/\s+/g, ' ').trim(),
    firstBlockText: qa('.lp-grid tbody tr').slice(0, 4).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim()),
  }
}

await page.goto('http://localhost:5173/#/login', { timeout: 40000 })
await page.waitForTimeout(3000)
console.log('LOGIN1=' + (await loginIfNeeded()))
await page.goto('http://localhost:5173/#/panelx/list/QC_LINE_PATROL', { timeout: 40000 })
await page.waitForTimeout(5000)
await loginIfNeeded()
await page.waitForTimeout(2000)
console.log('STATE0=' + JSON.stringify(await page.evaluate(SNAP)))
await restoreWindow()
await page.screenshot({ path: out + '/round-01-01-panel-open.png' })

// 侧栏「新增」= directAdd 建一张空白草稿(后端发号 + 单据日期=当天)
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').trim() === '新增')
  if (!btn) return false
  btn.click()
  return true
})
console.log('CLICK_ADD=' + clicked)
await page.waitForTimeout(6000)
await restoreWindow()
console.log('STATE1=' + JSON.stringify(await page.evaluate(SNAP)))
await page.screenshot({ path: out + '/round-01-02-new-3blocks.png' })
console.log('DONE')
