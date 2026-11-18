// round-06:打包版(8090)同样验证 —— 末道=组装装箱 的工单出现在列表且可开单
const OUT = 'C:/Users/vigna/ego/ship-insp-lastop-20261118'
const task = await taskSpace('ship-insp-lastop-20261118')
const page = task.page('p1')

const login = await fetch('http://127.0.0.1:8090/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
}).then((r) => r.json())

await page.goto('http://127.0.0.1:8090/#/login', { timeout: 60000 })
await page.waitForTimeout(1500)
await page.evaluate((arg) => {
  localStorage.setItem('mes_token', arg.token)
  localStorage.setItem('mes_user', JSON.stringify(arg.user))
  localStorage.setItem('mes_locale', 'zh-CN')
}, { token: login.data.token, user: login.data.user })

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_ASM_INSP', { timeout: 60000 })
await page.waitForTimeout(7000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  }
  await page.waitForTimeout(400)
} catch (e) {
  console.log('restore skip: ' + e.message)
}
await page.evaluate(() => {
  const el = [...document.querySelectorAll('div, span, a, li, button')]
    .filter((n) => (n.textContent || '').trim() === '选生产工单').pop()
  if (el) el.click()
})
await page.waitForTimeout(4500)

const summary = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('选生产工单'))
  if (!dlg) return { dialog: false }
  const heads = [...dlg.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const rows = [...dlg.querySelectorAll('.el-table__body tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
  const si = heads.indexOf('进入环节')
  const wi = heads.indexOf('工单号')
  const ci = heads.indexOf('可开单')
  return {
    dialog: true,
    tip: (dlg.querySelector('.wopick-tip') || {}).textContent?.trim(),
    gate: (dlg.querySelector('.wopick-gate') || {}).textContent?.trim(),
    total: (dlg.querySelector('.el-pagination__total') || {}).textContent?.trim(),
    asmEntryRows: rows.filter((r) => r[si] === '组装装箱').map((r) => ({ wo: r[wi], creatable: r[ci] })),
  }
})
console.log(JSON.stringify(summary, null, 2))
await page.screenshot({ path: OUT + '/06-8090-asm-picker.png' })
await task.finish({ keep: [] })
