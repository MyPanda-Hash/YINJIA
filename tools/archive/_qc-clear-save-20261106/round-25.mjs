const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0107', { timeout: 45000 })
await page.waitForTimeout(9000)

const dom = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td, th')]
  const labels = tds.map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()).filter((t) => t && t.length < 12)
  const areas = [...document.querySelectorAll('textarea')].map((ta, i) => ({
    i,
    cls: ta.className,
    val: (ta.value || '').slice(0, 20),
    rowText: (ta.closest('tr')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    editable: !ta.readOnly && !ta.disabled,
  }))
  const inputs = [...document.querySelectorAll('input')].map((inp, i) => ({
    i,
    ph: inp.placeholder,
    val: (inp.value || '').slice(0, 16),
    rowText: (inp.closest('tr')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
  })).filter((x) => x.rowText)
  return { labels: [...new Set(labels)].slice(0, 40), areas, inputs: inputs.slice(0, 25) }
})
console.log(JSON.stringify(dom, null, 2))
