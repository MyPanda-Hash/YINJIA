/**
 * round-04 — 真实链路:采购订单(测试库)工具栏「打印▼」→ 打印订单无金额 → 弹窗确定打印 → 看纸面
 *   验证:① 弹窗照旧;② 出纸的送货单页头带二维码;③ window.print 被打桩前纸面已就绪。
 */
const OUT = 'D:/YINJIA-main/_scratch/ego-delivery-qr-20261124'
const task = await taskSpace('delivery-qr-20261124')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.waitForTimeout(6000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed += 1 } })

// ① 点 ▼ 展开「打印」组 → 点「打印订单无金额」
const step1 = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const grp = [...document.querySelectorAll('.tb-group')].find((g) => (g.textContent || '').replace(/\s+/g, '').startsWith('打印'))
  grp?.querySelector('.tb-caret')?.click()
  await sleep(600)
  const items = [...document.querySelectorAll('.ctx-item')].map((el) => (el.textContent || '').trim())
  const hit = [...document.querySelectorAll('.ctx-item')].find((el) => (el.textContent || '').trim() === '打印订单无金额')
  hit?.click()
  await sleep(3000)
  const dlg = document.querySelector('.el-dialog')
  return {
    grpFound: !!grp,
    items,
    clicked: !!hit,
    dialogTitle: dlg ? (dlg.querySelector('.el-dialog__title')?.textContent || '').trim() : null,
    dialogButtons: dlg ? [...dlg.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean) : [],
    dialogRows: dlg ? dlg.querySelectorAll('.el-table__body tr').length : 0,
    dialogText: dlg ? (dlg.textContent || '').replace(/\s+/g, ' ').slice(0, 240) : '',
  }
})
console.log('① 展开打印菜单并点「打印订单无金额」= ' + JSON.stringify(step1, null, 2))
await page.screenshot({ path: OUT + '/round-04a-dialog.png' })

// ② 勾第一行 + 填数量 + 确定打印(不弹系统框)
const step2 = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const dlg = document.querySelector('.el-dialog')
  if (!dlg) return { error: 'no dialog' }
  const rows = [...dlg.querySelectorAll('.el-table__body tr')]
  const firstCk = rows[0]?.querySelector('input[type="checkbox"]')
  if (firstCk && !firstCk.checked) firstCk.click()
  await sleep(700)
  const nums = [...rows[0].querySelectorAll('input.el-input__inner')].filter((i) => i.type !== 'checkbox')
  const qty = nums[nums.length - 1]
  if (qty && !qty.value) {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(qty, '100'); qty.dispatchEvent(new Event('input', { bubbles: true })); qty.dispatchEvent(new Event('change', { bubbles: true }))
  }
  await sleep(500)
  const btns = [...dlg.querySelectorAll('button')]
  const target = btns.find((b) => /确定打印/.test(b.textContent || '')) || btns.find((b) => /确定/.test(b.textContent || ''))
  target?.click()
  await sleep(4500)
  const host = document.getElementById('yj-print-host')
  const img = host && host.querySelector('.hdqr img')
  const tableRows = host ? [...host.querySelectorAll('table tbody tr')].slice(0, 3).map((tr) =>
    [...tr.children].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())) : []
  return {
    clicked: target ? target.textContent.replace(/\s+/g, ' ').trim() : null,
    printed: window.__printed,
    hasHost: !!host,
    hdqr: host ? host.querySelectorAll('.hdqr').length : -1,
    qrImgChars: img ? img.src.length : 0,
    headText: host ? (host.textContent || '').replace(/\s+/g, ' ').slice(0, 120) : '',
    tableRows,
    msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()),
  }
})
console.log('② 确定打印 = ' + JSON.stringify(step2, null, 2))

// ③ print 媒体下截纸面
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(800)
await page.screenshot({ path: OUT + '/round-04b-delivery-note-real.png', fullPage: true })
await page.cdp('Emulation.setEmulatedMedia', { media: '' })

// ④ 收尾(摘层 + 关弹窗)
const step3 = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  document.getElementById('yj-print-host')?.remove()
  document.getElementById('yj-print-host-css')?.remove()
  const dlg = document.querySelector('.el-dialog')
  const cancel = dlg ? [...dlg.querySelectorAll('button')].find((b) => /取消|关闭/.test(b.textContent || '')) : null
  cancel?.click()
  await sleep(700)
  return { dialogClosed: !document.querySelector('.el-dialog') }
})
console.log('③ 收尾 = ' + JSON.stringify(step3))
await task.finish({ keep: [] })
