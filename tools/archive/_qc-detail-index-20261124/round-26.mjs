// round-26 — 点「取消完成」(气泡袋 JYSJ-2026-09-0048)→ 确认 → 行离开本表 → 待检验目录里重新出现
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc reopen button verify')
const page = task.page('p1')

if (!(await page.url()).includes('QC_INSP_REC_DETAIL')) {
  await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 180000 })
  await page.waitForTimeout(9000)
}
const before = await page.evaluate(() => ({
  total: (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0],
  cells: [...document.querySelectorAll('td .doc-no-link')].filter((e) => e.innerText.trim() === '取消完成').length,
}))

const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('td .doc-no-link')].find((e) => (e.innerText || '').trim() === '取消完成')
  if (!el) return ''
  const tr = el.closest('tr')
  const txt = tr ? tr.innerText.replace(/\s+/g, ' ').slice(0, 90) : ''
  el.click()
  return txt
})
await page.waitForTimeout(1500)
const dlg = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box')
  return box ? box.innerText.replace(/\s+/g, ' ').slice(0, 220) : 'NO-DIALOG'
})
console.log('① 点击行 = ' + clicked)
console.log('① 确认框 = ' + dlg)
await page.screenshot({ path: OUT + '/round-26-confirm.png' })

let confirmed = false
for (const sel of ['.el-message-box__btns button.el-button--primary', '.el-message-box__btns .el-button--primary', '.el-message-box__btns button:last-child']) {
  try { await page.click(sel, { timeout: 4000 }); confirmed = true; break } catch (e) { /* next */ }
}
console.log('① 已点确认 = ' + confirmed)
// 收集消息(3s 内)
const seen = new Set()
const end = Date.now() + 6000
while (Date.now() < end) {
  const now = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
  now.forEach((m) => seen.add(m))
  await page.waitForTimeout(150)
}
const after = await page.evaluate(() => ({
  total: (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0],
  cells: [...document.querySelectorAll('td .doc-no-link')].filter((e) => e.innerText.trim() === '取消完成').length,
  stillHasRow: document.body.innerText.includes('JYSJ-2026-09-0048'),
}))
console.log('② 取消完成前 = ' + JSON.stringify(before))
console.log('② 取消完成后 = ' + JSON.stringify(after) + ' 消息=' + JSON.stringify([...seen]))
await page.screenshot({ path: OUT + '/round-26-after.png' })

// ③ 待检验目录里重新出现
await page.goto(BASE + '/#/panelx/list/QC_CATALOG', { timeout: 180000 })
await page.waitForTimeout(9000)
const cat = await page.evaluate(() => {
  const txt = document.body.innerText.replace(/\s+/g, ' ')
  return { hasBubble: txt.includes('气泡袋'), hasRecNo: txt.includes('JYSJ-2026-09-0048'), hasInsp: txt.includes('IJ-2026-09-0152') }
})
console.log('③ 待检验目录 = ' + JSON.stringify(cat))
await page.screenshot({ path: OUT + '/round-26-catalog.png' })
