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

const probe = await page.evaluate(() => {
  const out = { labels: [], block: null, stdlibBtns: [] }
  const tds = [...document.querySelectorAll('td')]
  // 找到「管控要求」标签格
  const label = tds.find((td) => (td.innerText || '').replace(/\s+/g, '') === '管控要求')
  if (label) {
    const tr = label.closest('tr')
    const next = tr && tr.nextElementSibling
    const cells = next ? [...next.children].map((c) => ({
      tag: c.tagName,
      text: (c.innerText || '').replace(/\s+/g, ' ').trim(),
      hasSelect: !!c.querySelector('.el-select'),
      hasLibBtn: !!c.querySelector('.rs-lib-btn'),
      placeholder: (c.querySelector('.el-select__placeholder')?.innerText || c.querySelector('input')?.placeholder || '').trim(),
    })) : []
    out.block = { labelRow: [...tr.children].map((c) => (c.innerText || '').replace(/\s+/g, ' ').trim()), nextRow: cells }
    label.scrollIntoView({ block: 'center' })
  }
  out.stdlibBtns = [...document.querySelectorAll('.rs-lib-btn, .rsp-lib-pick')].map((n) => (n.innerText || '').trim()).slice(0, 12)
  return out
})
console.log(JSON.stringify(probe, null, 1))
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/06-density-block.png` })
await task.finish({ keep: [] })
process.exit(0)
