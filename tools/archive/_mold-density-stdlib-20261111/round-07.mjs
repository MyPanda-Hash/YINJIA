const OUT = '/Users/panda/Projects/_yinjia-w-sql/_scratch/ego-yj-density-20261111'
const task = await taskSpace('烧结 密度管控标准库验证')
const page = task.page('p1')
const base = 'http://localhost:5173'

await page.goto(`${base}/#/login`, { timeout: 40000 })
await page.waitForTimeout(1500)
await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const j = await r.json()
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user))
  localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
  localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))
})
await page.goto(`${base}/#/panelx/list/RD_MOLD_PROC`, { timeout: 40000 })
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(8000)

const opened = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const tds = [...document.querySelectorAll('td')]
  const label = tds.find((td) => (td.innerText || '').replace(/\s+/g, '') === '管控要求')
  const next = label && label.closest('tr').nextElementSibling
  const cell = next && next.children[0]
  if (!cell) return { err: 'cell not found' }
  const w = cell.querySelector('.el-select__wrapper') || cell.querySelector('.el-select')
  w.scrollIntoView({ block: 'center' })
  await sleep(300)
  w.click()
  await sleep(900)
  const opts = [...document.querySelectorAll('.el-select-dropdown__item')].map((n) => n.innerText.trim())
  return { opts }
})
console.log('options ->', JSON.stringify(opened))
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/07-density-dropdown.png` })
await task.finish({ keep: [] })
process.exit(0)
