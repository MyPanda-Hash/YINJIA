const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
// ① 打印版面:按应用自己的打印口径给 body 加 approval-printing,再模拟 print media
await page.evaluate(() => document.body.classList.add('approval-printing'))
try { await page.cdp('Emulation.setEmulatedMedia', { media: 'print' }) } catch (e) { console.log('emul skip: ' + e.message) }
await page.waitForTimeout(1500)
const printProbe = await page.evaluate(() => {
  const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => getComputedStyle(e).display !== 'none')
  const cells = [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr:first-child td.c-res')]
  const th = [...document.querySelectorAll('.qc-rec-sheet table.qr-table thead th')].map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    addBarVisible: vis('.qr-addbar'),
    opColVisible: vis('.c-op'),
    resCellWidths: cells.map((c) => Math.round(c.getBoundingClientRect().width)),
    thead: th,
    row1: cells.map((c) => { const i = c.querySelector('input'); return i ? i.value : (c.textContent || '').trim() }),
  }
})
console.log('PRINT ' + JSON.stringify(printProbe, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-16-print.png' })
await page.evaluate(() => document.body.classList.remove('approval-printing'))
try { await page.cdp('Emulation.setEmulatedMedia', { media: 'screen' }) } catch (e) {}

// ② 只读态(单据预览):五格应当只剩文本
await page.waitForTimeout(800)
const toggled = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.approval-side .as-side-btn')].find((b) => (b.textContent || '').replace(/\s+/g, '') === '单据预览')
  if (!btn) return 'NO-PREVIEW-BTN'
  btn.click()
  return 'PREVIEW-CLICKED'
})
console.log(toggled)
await page.waitForTimeout(3500)
const ro = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    editableInputs: document.querySelectorAll('.qc-rec-sheet table.qr-table tbody td.c-res input').length,
    rows: [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) => ({
      res: [...tr.querySelectorAll('td.c-res')].map((c) => (txt(c) || '')),
    })),
    side: (txt(document.querySelector('.approval-side')) || '').slice(0, 30),
  }
})
console.log('READONLY ' + JSON.stringify(ro, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-16-readonly.png' })
