// round-08:①打印版面(模拟 body.approval-printing + print media,20 列最坏情况);②已审核单只读态
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(4500)

const info = async (tag) => {
  const st = await page.evaluate(() => {
    const wrap = document.querySelector('.qr-table-scroll')
    const table = document.querySelector('.qr-table')
    return {
      n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
      stepperVisible: !!document.querySelector('.qr-colstep') && getComputedStyle(document.querySelector('.qr-colstep')).display !== 'none',
      tableWidth: table ? Math.round(table.getBoundingClientRect().width) : null,
      tableLayout: table ? getComputedStyle(table).tableLayout : null,
      wrapScrollW: wrap ? wrap.scrollWidth : null,
      wrapVisibleW: wrap ? wrap.clientWidth : null,
      editableInputs: document.querySelectorAll('.qr-table tbody td.c-res input').length,
      readonlyTexts: document.querySelectorAll('.qr-table tbody td.c-res .qr-cell-text').length,
      cOpVisible: (() => { const e = document.querySelector('.qr-table .c-op'); return e ? getComputedStyle(e).display : null })(),
    }
  })
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await info('screen-6')

// 加到 20 列(最坏打印情况)
for (let i = 0; i < 14; i++) { await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' }); await page.waitForTimeout(160) }
await page.waitForTimeout(600)
await info('screen-20')

// 模拟打印:body.approval-printing + print media(与 PanelxList.printDoc 同一套)
await page.evaluate(() => document.body.classList.add('approval-printing'))
await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
await page.waitForTimeout(1200)
await info('print-20')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-08-print-20cols.png', fullPage: true })

// 复位
await page.cdp('Emulation.setEmulatedMedia', { media: '' })
await page.evaluate(() => document.body.classList.remove('approval-printing'))
await page.waitForTimeout(400)

// ② 已审核单:只读态(没有步进器 / 没有输入框 / 显示 n 个格子)
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0006', { timeout: 40000 })
await page.waitForTimeout(4500)
await info('readonly-approved')
const ro = await page.evaluate(() => ({
  docNo: (document.querySelector('.as-doc-chip, .doc-pick-title')?.textContent || '').trim(),
  headCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
  texts: [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res .qr-cell-text')].map((e) => (e.textContent || '').trim()),
  stepper: document.querySelector('.qr-colstep') ? 1 : 0,
}))
console.log('readonly-detail ' + JSON.stringify(ro))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-08-readonly.png' })
