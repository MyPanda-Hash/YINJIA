/* round-04.mjs — 读「带入结果」要连输入框的值一起读;顺带侦察右侧按钮 */
const task = await taskSpace('qc-carry-20261112')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0010', { timeout: 60000 })
await page.waitForTimeout(7000)

const dump = await page.evaluate(() => {
  const tbl = [...document.querySelectorAll('table.qr-table')]
    .find((t) => /检验项/.test((t.querySelector('thead') || {}).innerText || ''))
  const rows = tbl ? [...tbl.querySelectorAll('tbody tr')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    const cellVal = (td) => {
      const inp = td.querySelector('input, textarea')
      if (inp) return (inp.value || '').replace(/\s+/g, ' ').trim()
      const sel = td.querySelector('.el-select')
      if (sel) return (sel.innerText || '').replace(/\s+/g, ' ').trim()
      return (td.innerText || '').replace(/\s+/g, ' ').trim()
    }
    return tds.map(cellVal)
  }) : []
  const railBtns = [...document.querySelectorAll('.approval-side *, .as-btn, .side-btn')]
    .filter((el) => el.children.length === 0 && (el.innerText || '').trim())
    .map((el) => ({ cls: el.className, txt: (el.innerText || '').trim() }))
    .slice(0, 40)
  const headCode = [...document.querySelectorAll('table.qr-table')][0]
  return { rows, railBtns, head: headCode ? (headCode.innerText || '').replace(/\s+/g, ' ') : '' }
})
console.log('rows(含输入框值) ->', JSON.stringify(dump.rows, null, 2))
console.log('railBtns ->', JSON.stringify(dump.railBtns, null, 2))
console.log('head ->', dump.head.slice(0, 240))
