const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
const info = await page.evaluate(() => {
  const sheet = document.querySelector('.approval-sheet')
  if (!sheet) return { err: 'no sheet' }
  document.getElementById('__force940')?.remove()
  const before = Math.round(sheet.getBoundingClientRect().height)
  const st = document.createElement('style')
  st.id = '__force940'
  st.textContent = '.approval-sheet{width:940px !important; max-width:940px !important; flex:none !important}'
  document.head.appendChild(st)
  const after = Math.round(sheet.getBoundingClientRect().height)
  const rows = [...sheet.querySelectorAll('.as-row')].slice(0, 4).map((r) => ({ t: (r.innerText || '').replace(/\s+/g, ' ').slice(0, 26), w: Math.round(r.getBoundingClientRect().width), h: Math.round(r.getBoundingClientRect().height) }))
  document.getElementById('__force940')?.remove()
  return { before, after, rows }
})
console.log(JSON.stringify(info, null, 2))
