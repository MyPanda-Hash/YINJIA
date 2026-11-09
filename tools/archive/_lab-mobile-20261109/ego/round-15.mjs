const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/dashboard', { timeout: 30000 })
await page.waitForTimeout(800)
await page.goto('http://localhost:5173/#/panelx/list/RD_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(8000)
const probe = await page.evaluate(() => ({
  strips: document.querySelectorAll('.attach-strip').length,
  facChips: [...document.querySelectorAll('.fac-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  facEmpty: [...document.querySelectorAll('.fac-empty')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  facLegacy: [...document.querySelectorAll('.fac-legacy')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  uploadBtn: [...document.querySelectorAll('.fac-upload-btn')].map((e) => (e.textContent || '').trim()),
  docNoText: [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /EU-2026-11-000/.test(e.textContent || '')).map((e) => e.textContent.trim()).slice(0, 6),
  headValues: [...document.querySelectorAll('.head-grid input, .hg-val, .doc-head input')].slice(0, 8).map((e) => e.value ?? e.textContent),
}))
console.log(JSON.stringify(probe, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-15-pc-panel.png' })
