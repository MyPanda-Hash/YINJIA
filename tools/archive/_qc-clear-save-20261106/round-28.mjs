const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0107', { timeout: 45000 })
await page.waitForTimeout(9000)

const cands = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('*')) {
    const t = (el.textContent || '').replace(/\s+/g, '').trim()
    if (t === '保存' && el.children.length === 0) {
      const r = el.getBoundingClientRect()
      out.push({ tag: el.tagName, cls: String(el.className).slice(0, 60), w: Math.round(r.width), h: Math.round(r.height), parentCls: String(el.parentElement?.className || '').slice(0, 60) })
    }
  }
  return out.slice(0, 10)
})
console.log('保存 候选: ' + JSON.stringify(cands, null, 2))

const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) => (e.textContent || '').replace(/\s+/g, '').trim() === '保存' && e.children.length === 0)
  if (!el) return 'none'
  const target = el.closest('button, .el-button, [class*="btn"], [class*="action"]') || el.parentElement || el
  target.click()
  return 'clicked:' + target.tagName + '.' + String(target.className).slice(0, 40)
})
console.log('点击 -> ' + clicked)

const seen = []
for (let i = 0; i < 6; i++) {
  const now = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((n) => (n.innerText || '').replace(/\s+/g, ' ').trim()))
  for (const t of now) if (!seen.includes(t)) seen.push(t)
  await page.waitForTimeout(1000)
}
console.log('toast: ' + JSON.stringify(seen))
