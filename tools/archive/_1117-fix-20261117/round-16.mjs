const task = await taskSpace('rd-prod-verify')
const page = await task.newPage()
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })
await page.goto('http://36.140.66.163:8090/#/login')
await page.waitForTimeout(5000)
await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }) })
  const j = await r.json()
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user))
  localStorage.setItem('mes_login_date', new Date().toISOString().slice(0, 10))
})
await page.reload(); await page.waitForTimeout(10000)
await page.evaluate(() => { location.hash = '#/panelx/list/RD_ASM_PROC' })
await page.waitForTimeout(12000)
const info = await page.evaluate(() => {
  // 只找"纸面"容器里的那一格：RecordSheetPanels 的根类名 rsp-*
  const sheet = document.querySelector('[class*="rsp-"]') || document.querySelector('.rs-sheet') || document.body
  const all = [...sheet.querySelectorAll('td, .rs-label, span, div')]
  const out = {}
  for (const label of ['表单管理人', '审核人']) {
    const el = all.find(e => (e.textContent || '').trim() === label && e.children.length === 0)
    if (!el) { out[label] = '(未找到 label)'; continue }
    const td = el.closest('td') || el.parentElement
    const next = td?.nextElementSibling
    out[label] = next ? (next.textContent || '').replace(/\s+/g, ' ').trim() : '(无下一格)'
  }
  out._sheetFound = sheet !== document.body
  return out
})
console.log('纸面表头:', JSON.stringify(info, null, 1))
await task.finish({ keep: [] })
process.exit(0)
