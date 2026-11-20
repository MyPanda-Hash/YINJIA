const fs = await import('node:fs/promises')
const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
const runPrint = async (tag, hideNewRow) => {
  await page.evaluate((hide) => {
    document.getElementById('__force940')?.remove()
    const st = document.createElement('style')
    st.id = '__force940'
    st.textContent = '.approval-sheet{width:940px !important; max-width:940px !important; flex:none !important}'
      + (hide ? ' .approval-sheet .as-row:nth-of-type(3){display:none !important}' : '')
    document.head.appendChild(st)
    document.body.classList.add('approval-printing')
    const sheet = document.querySelector('.approval-sheet')
    const paperW = sheet ? Math.max(sheet.scrollWidth, sheet.offsetWidth) : 940
    const zoom = Math.max(0.32, Math.min(1, 733 / paperW))
    document.documentElement.style.setProperty('--print-zoom', String(zoom))
    const st2 = document.createElement('style')
    st2.id = '__pdfpage'
    st2.textContent = '@page { size: A4 portrait; margin: 8mm; }'
    document.head.appendChild(st2)
    window.__printMeta = { paperW, zoom, sheetH: sheet ? Math.round(sheet.getBoundingClientRect().height) : 0 }
  }, !!hideNewRow)
  const meta = await page.evaluate(() => window.__printMeta)
  const res = await page.cdp('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.31, marginBottom: 0.31, marginLeft: 0.31, marginRight: 0.31 })
  const buf = Buffer.from(res.data, 'base64')
  await fs.writeFile(`C:/Users/vigna/ego/qc-ng-20261120/bhc-print-${tag}.pdf`, buf)
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
  await page.evaluate(() => {
    document.body.classList.remove('approval-printing')
    document.documentElement.style.removeProperty('--print-zoom')
    document.getElementById('__pdfpage')?.remove()
    document.getElementById('__force940')?.remove()
  })
  return { tag, ...meta, pages }
}
console.log(JSON.stringify(await runPrint('with-new-row', false), null, 2))
console.log(JSON.stringify(await runPrint('without-new-row', true), null, 2))
