const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
const info = await page.evaluate(() => {
  const sheet = document.querySelector('.approval-sheet')
  if (!sheet) return { err: 'no sheet' }
  const before = Math.round(sheet.getBoundingClientRect().height)
  const st = document.createElement('style')
  st.id = '__force940'
  st.textContent = '.approval-sheet{width:940px !important; max-width:940px !important; flex:none !important}'
  document.head.appendChild(st)
  const rows = [...sheet.querySelectorAll('.as-row')].map((r) => ({ t: (r.innerText || '').replace(/\s+/g, ' ').slice(0, 30), h: Math.round(r.getBoundingClientRect().height) }))
  const after = Math.round(sheet.getBoundingClientRect().height)
  return { before, after, rows }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s22-forced940.png' })
