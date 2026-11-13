const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0001', { timeout: 60000 })
await page.waitForTimeout(8000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { console.log('restore skip: ' + e.message) }

const readback = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    side: (txt(document.querySelector('.approval-side')) || '').slice(0, 40),
    headVals: [...document.querySelectorAll('.qr-head-table .qr-value')].map((c) => (txt(c) || '').slice(0, 16)),
    rows: [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) => ({
      std: tr.querySelector('td.c-std input') ? tr.querySelector('td.c-std input').value : txt(tr.querySelector('td.c-std')),
      res: [...tr.querySelectorAll('td.c-res')].map((c) => { const i = c.querySelector('input'); return i ? i.value : (txt(c) || '') }),
    })),
  }
})
console.log('READBACK ' + JSON.stringify(readback, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-15.png' })

// 打印观感:CDP 模拟 print media 后截图(等价于打印时的版面)
try {
  await page.cdp('Emulation.setEmulatedMedia', { media: 'print' })
  await page.waitForTimeout(1500)
  const printProbe = await page.evaluate(() => {
    const tb = document.querySelector('.qc-rec-sheet table.qr-table')
    const cells = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr:first-child td.c-res')]
    return {
      hasPrint: !!tb,
      resCellWidths: cells.map((c) => Math.round(c.getBoundingClientRect().width)),
      sheetWidth: Math.round(document.querySelector('.qc-rec-sheet').getBoundingClientRect().width),
      addBarVisible: [...document.querySelectorAll('.qr-addbar')].some((e) => getComputedStyle(e).display !== 'none'),
      opColVisible: [...document.querySelectorAll('.c-op')].some((e) => getComputedStyle(e).display !== 'none'),
    }
  })
  console.log('PRINT ' + JSON.stringify(printProbe, null, 2))
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-15-print.png', fullPage: false })
} catch (e) { console.log('print emulation skip: ' + e.message) }
try { await page.cdp('Emulation.setEmulatedMedia', { media: 'screen' }) } catch (e) {}
