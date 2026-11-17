// round-34: 检出限改名容错(表头/行值都认)+ 弹窗模式仍在
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(7000)

const added = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.textContent || '').trim() === '新增')
  if (!btn) return 'no-btn'
  btn.click()
  return 'clicked'
})
console.log('add=' + added)
await T(8000)

// 带入 1 行,看小表列头/值
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('选择检验项目'))
  btn?.click()
})
await T(4500)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent && !d.classList.contains('ic-contact-dialog'))
  dlg?.querySelector('.el-table__body tr .el-checkbox')?.click()
})
await T(900)
await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent && !d.classList.contains('ic-contact-dialog'))
  const btn = [...(dlg?.querySelectorAll('button') || [])].find((b) => /带入/.test(b.textContent || ''))
  btn?.click()
})
await T(3500)

const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  const headers = [...sheet.querySelectorAll('.ic-items thead th')].map((th) => txt(th))
  const firstRow = [...sheet.querySelectorAll('.ic-items tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => txt(td)))
  const contactCell = txt([...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(txt(r))))
  return { headers, firstRow, contactCell, docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value) }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: dir + '/shots/round-34-limit-rename.png' })
