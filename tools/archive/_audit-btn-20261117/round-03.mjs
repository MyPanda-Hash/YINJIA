// 复验第二轮:改造后的 10 张 T+ 式出入库单,逐个打开页面读工具栏 + 「审核」是否置灰(草稿应可点)。
const PANELS = ['PURCHASE_IN', 'SALE_OUT', 'SALE_IN', 'MATERIAL_OUT', 'MATERIAL_RET', 'FINISH_IN',
  'OTHER_IN', 'OTHER_OUT', 'TRANSFER', 'STOCKTAKE']

const task = await taskSpace('audit-direct-audit-20261117')
const page = task.page('p1')
if (!(await page.evaluate(() => localStorage.getItem('mes_token')))) {
  throw new Error('会话已失效,先跑一次登录')
}

const out = []
for (const code of PANELS) {
  await page.goto('http://localhost:5173/#/panelx/list/' + code, { timeout: 30000 })
  await page.waitForTimeout(1800)
  out.push(await page.evaluate(() => {
    const groups = [...document.querySelectorAll('.tb-group')]
    const btn = groups.find((g) => (g.querySelector('.tb-main')?.textContent || '').trim() === '审核')
    return {
      hash: location.hash,
      status: (document.querySelector('.doc-status')?.textContent || '').trim(),
      docNo: (document.querySelector('.doc-chip')?.textContent || '').trim(),
      toolbar: groups.map((g) => (g.querySelector('.tb-main')?.textContent || '').trim()),
      auditPresent: Boolean(btn),
      auditDisabled: btn ? btn.querySelector('.tb-main')?.classList.contains('disabled') : null,
    }
  }))
}
console.log(JSON.stringify(out, null, 1))
await page.goto('http://localhost:5173/#/panelx/list/TRANSFER', { timeout: 30000 })
await page.waitForTimeout(2500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-direct-audit-20261117/transfer-toolbar.png' })
