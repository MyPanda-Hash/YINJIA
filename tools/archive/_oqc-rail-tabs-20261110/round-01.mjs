// round-01:登录 + 打开「出货检验单功能 QC_PROC_INSP」,读取左栏页签与列表状态
const OUT = 'C:/Users/vigna/ego/oqc-rail-tabs-20261110'
const task = await taskSpace('oqc-rail-tabs-20261110')
const page = task.page('p1')

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(500)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

const probe = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const rail = q('.doc-select-rail')
  const rows = rail ? [...rail.querySelectorAll('.dsr-grid tbody tr')] : []
  const rowData = rows.slice(0, 8).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
  return {
    hash: location.hash,
    loginPage: !!q('input[placeholder*="密码"]'),
    loginFactory: txt(q('.login-factory')) || txt(q('[class*="factory"]')),
    panelTitle: txt(q('.doc-chip')),
    docStatus: txt(q('.doc-status')),
    railTitle: txt(q('.dsr-head .dsr-title')),
    tabs: [...document.querySelectorAll('.dsr-tabs .dsr-tab')].map((b) => ({ text: b.textContent.trim(), active: b.classList.contains('active') })),
    count: txt(q('.dsr-count')),
    rowCount: rows.length,
    tagCounts: [...rail ? rail.querySelectorAll('.dsr-grid tbody .dsr-tag') : []].reduce((a, el) => { const k = el.textContent.trim(); a[k] = (a[k] || 0) + 1; return a }, {}),
    firstRows: rowData,
    noRail: !rail,
    errToasts: [...document.querySelectorAll('.el-message--error')].map((e) => e.textContent.trim()),
  }
})

await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(4000)
console.log('AFTER_GOTO=' + JSON.stringify(await probe()))

// 登录页则自动登录(admin / 123456;登录工厂保持默认 YJ = 正式库)
const st = await probe()
if (st.loginPage) {
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
  await page.waitForTimeout(6000)
  await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
  await page.waitForTimeout(5000)
}
await shot('round-01-initial')
console.log('STATE=' + JSON.stringify(await probe(), null, 2))
console.log('SPACE=' + task.spaceId)
