const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6000)
const info = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('.approval-sheet')
  const measure = () => ({
    sheetW: Math.round(sheet.getBoundingClientRect().width),
    sheetH: Math.round(sheet.getBoundingClientRect().height),
    rows: [...sheet.querySelectorAll('.as-row')].slice(0, 5).map((r) => ({ t: txt(r).slice(0, 34), h: Math.round(r.getBoundingClientRect().height) })),
  })
  const at542 = measure()
  const st = document.createElement('style')
  st.id = '__force940'
  st.textContent = '.approval-sheet{width:940px !important; max-width:940px !important; flex:none !important}'
  document.head.appendChild(st)
  const at940 = measure()
  st.remove()
  return { hash: location.hash, at542, at940, inputs: [...sheet.querySelectorAll('input,textarea')].map((i) => i.value).filter(Boolean).slice(0, 12) }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s24-bhc-newlayout.png' })
