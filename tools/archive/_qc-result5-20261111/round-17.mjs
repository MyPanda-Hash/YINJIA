const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')

async function probeDoc(no) {
  await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=' + no, { timeout: 60000 })
  await page.waitForTimeout(7000)
  return page.evaluate(() => {
    const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
    return {
      side: (txt(document.querySelector('.approval-side')) || '').slice(0, 34),
      rows: [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) => ({
        res: [...tr.querySelectorAll('td.c-res')].map((c) => { const i = c.querySelector('input'); return i ? i.value : (txt(c) || '') }),
        editable: !!tr.querySelector('td.c-res input'),
      })),
    }
  })
}

const a = await probeDoc('JYSJ-2026-09-0037')
console.log('A(archived 09-0037) ' + JSON.stringify(a))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-17-a.png' })

const b = await probeDoc('JYSJ-2026-09-0001')
console.log('B(backfill 09-0001) ' + JSON.stringify(b))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-17-b.png' })
