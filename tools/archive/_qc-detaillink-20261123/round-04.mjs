// round-04.mjs —— 追 A1(第 1 行单据编号点击后没读到单号):先验直接深链,再验点击+更长等待
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const LIST = 'http://localhost:5173/#/panelx/list/QC_ASM_INSP_DETAIL'

async function loginIfNeeded() {
  const inputs = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.placeholder || ''))
  if (!inputs.some((p) => p.includes('账号'))) return false
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
  return true
}
async function waitRows(limit = 25) {
  for (let i = 0; i < limit; i++) {
    const n = await page.evaluate(() => document.querySelectorAll('.report-table .el-table__body tr').length)
    if (n > 0) return n
    await page.waitForTimeout(1000)
  }
  return 0
}
function probe(no) {
  const res = { hash: location.hash, title: document.title, inputs: [], texts: [], emptyState: '' }
  for (const el of document.querySelectorAll('input, textarea')) {
    const v = String(el.value || '')
    if (v) res.inputs.push({ cls: el.className, value: v })
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    const t = (node.nodeValue || '').trim()
    if (t.includes(no)) res.texts.push({ cls: node.parentElement?.className || '', value: t })
    if (t && /暂无|没有|空/.test(t) && t.length < 40) res.emptyState = t
    if (res.texts.length > 12) break
  }
  res.hit = res.texts.length > 0 || res.inputs.some((i) => i.value.includes(no))
  return res
}

const out = {}

// ① 直接深链(跳过点击链路,单独验 ?docNo= 定位)
await page.goto(LIST, { timeout: 30000 })
await page.waitForTimeout(2500)
if (await loginIfNeeded()) { await page.goto(LIST, { timeout: 30000 }); await page.waitForTimeout(5000) }
await waitRows()
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP?docNo=ZJ-2026-11-0009', { timeout: 30000 })
await page.waitForTimeout(9000)
out['deep-link'] = await page.evaluate(probe, 'ZJ-2026-11-0009')

// ② 点击链路 + 更长等待
await page.goto(LIST, { timeout: 30000 })
await page.waitForTimeout(3000)
await waitRows()
const picked = await page.evaluate(() => {
  const tr = document.querySelectorAll('.report-table .el-table__body tr')[0]
  const cells = [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim())
  const docLink = [...tr.querySelectorAll('.doc-no-link')][0]
  const text = docLink.textContent.trim()
  docLink.click()
  return { docNo: cells[2], clicked: text }
})
await page.waitForTimeout(10000)
out['click'] = await page.evaluate(probe, picked.docNo)
out['click'].picked = picked

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detaillink-20261123/round-04-click-long-wait.png' })
console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: [] })
