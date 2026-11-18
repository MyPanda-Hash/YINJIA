const task = await taskSpace('wo-report-daterange-20261118')
const page = task.page('p1')
const out = await page.evaluate(async () => {
  const r = await fetch('/src/core/views/PanelxList.vue?t=1')
  const txt = await r.text()
  const idx = txt.indexOf('reportSums')
  const dateField = [...document.querySelectorAll('.udl-fields .field')].find((f) => (f.querySelector('label') || {}).textContent?.includes('单据日期'))
  return {
    status: r.status,
    srcLen: txt.length,
    hasReportSums: idx >= 0,
    snippet: idx >= 0 ? txt.slice(idx - 120, idx + 300) : null,
    dateFieldHtml: dateField ? dateField.innerHTML.slice(0, 700) : null,
  }
})
console.log(JSON.stringify(out, null, 2))
