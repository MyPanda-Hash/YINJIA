// round-17 — 先整页重载拿到最新模块,再逐个深链验证(避免 SPA 内复用旧模块)
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')

await page.goto(BASE + '/#/dashboard', { timeout: 120000 })
await page.reload({ timeout: 120000 })
await page.waitForTimeout(8000)
console.log('reloaded, url=' + await page.url())

async function probe(query, ms) {
  await page.goto(BASE + '/#/panelx/list/QC_INSP' + query, { timeout: 120000 })
  const seen = new Set()
  const end = Date.now() + (ms || 7000)
  while (Date.now() < end) {
    const now = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
    now.forEach((m) => seen.add(m))
    await page.waitForTimeout(150)
  }
  const rows = await page.evaluate(() => {
    const t = [...document.querySelectorAll('table')].find((x) => x.querySelectorAll('tbody tr').length > 0)
    return t ? t.querySelectorAll('tbody tr').length : 0
  })
  const doc = await page.evaluate(() => (document.body.innerText.match(/单据：([^\s]+)/) || ['', ''])[1])
  // 回到「空白」路由,保证下一次是真正的同 path 路由变化
  await page.goto(BASE + '/#/dashboard', { timeout: 120000 })
  await page.waitForTimeout(1200)
  return { msgs: [...seen], rows, doc }
}

console.log('已作废 → ' + JSON.stringify(await probe('?docNo=IJ-2026-10-0036')))
console.log('不存在 → ' + JSON.stringify(await probe('?docNo=IJ-2099-01-9999')))
console.log('存在   → ' + JSON.stringify(await probe('?docNo=IJ-2026-10-0020', 5000)))
