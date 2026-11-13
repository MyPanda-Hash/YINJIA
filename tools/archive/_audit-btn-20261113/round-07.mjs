// round-07: 紧凑取证 —— 当前账套/单据状态/工具栏/左栏草稿单清单(写到文件,避免 stdout 被截断)。
const fs = await import('node:fs/promises')
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)

const dump = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')].map((tr) => {
    const cells = [...tr.querySelectorAll('td')].map((td) => text(td))
    return { no: cells[1], status: cells[cells.length - 1] }
  })
  return {
    hash: location.hash,
    factory: text(document.querySelector('.factory-name, .topbar-factory, .doc-chip')),
    doc: text(document.querySelector('.doc-chip')),
    status: text(document.querySelector('.doc-status')),
    toolbar: [...document.querySelectorAll('.tools .tb-group')].map((g) => ({
      main: text(g.querySelector('.tb-main')),
      disabled: (g.querySelector('.tb-main')?.className || '').includes('disabled'),
    })),
    drafts: rows.filter((r) => r.status === '草稿'),
    total: rows.length,
    statusSet: [...new Set(rows.map((r) => r.status))],
  }
})
await fs.writeFile('C:/Users/Lenovo/ego/audit-btn-20261113/round-07.json', JSON.stringify(dump, null, 2), 'utf8')
console.log('wrote round-07.json; drafts=' + dump.drafts.length + ' total=' + dump.total)
