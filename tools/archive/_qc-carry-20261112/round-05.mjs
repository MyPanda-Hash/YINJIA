/* round-05.mjs — 3 张单:读带入结果 → 保存为草稿;第 3 张先清空再点「带入检验要求」验证按钮本身 */
const task = await taskSpace('qc-carry-20261112')
const page = task.page('p1')
const DOCS = ['JYSJ-2026-11-0010', 'JYSJ-2026-11-0011', 'JYSJ-2026-11-0012']

const readRows = () => page.evaluate(() => {
  const tbl = [...document.querySelectorAll('table.qr-table')]
    .find((t) => /检验项/.test((t.querySelector('thead') || {}).innerText || ''))
  if (!tbl) return []
  return [...tbl.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => {
    const inp = td.querySelector('input, textarea')
    if (inp) return (inp.value || '').replace(/\s+/g, ' ').trim()
    const sel = td.querySelector('.el-select')
    if (sel) return (sel.innerText || '').replace(/\s+/g, ' ').trim()
    return (td.innerText || '').replace(/\s+/g, ' ').trim()
  }))
})
const clickText = (sel, text) => page.evaluate(({ sel, text }) => {
  const el = [...document.querySelectorAll(sel)].find((x) => (x.textContent || '').trim() === text)
  if (!el) return 'not-found'
  el.click()
  return 'clicked'
}, { sel, text })

const res = {}
for (const no of DOCS) {
  await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=' + no, { timeout: 60000 })
  await page.waitForTimeout(7000)
  let rows = await readRows()
  const autoCarried = rows.map((r) => r.slice(0, 3))

  if (no === 'JYSJ-2026-11-0012') {
    // 清空自动带入的行,再用「带入检验要求」按钮补回来(证明按钮本身有效)
    const cleared = await page.evaluate(() => {
      const tbl = [...document.querySelectorAll('table.qr-table')]
        .find((t) => /检验项/.test((t.querySelector('thead') || {}).innerText || ''))
      if (!tbl) return 0
      let n = 0
      for (;;) {
        const tds = [...tbl.querySelectorAll('tbody tr td')]
        const x = tds.find((td) => (td.innerText || '').trim() === '×')
        if (!x) break
        x.click()
        n += 1
        if (n > 20) break
      }
      return n
    })
    await page.waitForTimeout(1500)
    const clickedCarry = await page.evaluate(() => {
      const b = document.querySelector('.qr-carry-btn')
      if (!b) return 'no-btn'
      b.click()
      return 'clicked'
    })
    await page.waitForTimeout(4000)
    rows = await readRows()
    res['cleared-' + no] = { cleared, clickedCarry, rowsAfterButton: rows.map((r) => r.slice(0, 3)) }
  } else {
    const carryAgain = await page.evaluate(() => {
      const b = document.querySelector('.qr-carry-btn')
      if (!b) return 'no-btn'
      b.click()
      return 'clicked'
    })
    await page.waitForTimeout(3000)
    const toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()))
    res['idempotent-' + no] = { carryAgain, toasts }
  }

  const saved = await clickText('.as-side-btn', '保存为草稿')
  await page.waitForTimeout(4500)
  const toasts2 = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((el) => (el.innerText || '').replace(/\s+/g, ' ').trim()))
  res['doc-' + no] = { autoCarried, saved, toasts2, rowsNow: (await readRows()).map((r) => r.slice(0, 3)) }
}
console.log(JSON.stringify(res, null, 2))
