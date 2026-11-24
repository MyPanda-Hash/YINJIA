// round-03.mjs —— 「单据编号」跳转后是否**定位到被点的那张单**(2026-11-23)
// round-02 里 docNoOnPage 为空是读数方式错了(§5⑥:el-input 的值不进 innerText)⇒ 本轮改读控件 value/属性。
// 判据:点第 N 行的单据编号 → 落点面板的纸面/头字段里出现该单号,且不是列表第一张(换一行再验一次)。
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
async function openList() {
  await page.goto(LIST, { timeout: 30000 })
  await page.waitForTimeout(2500)
  if (await loginIfNeeded()) { await page.goto(LIST, { timeout: 30000 }); await page.waitForTimeout(5000) }
  for (let i = 0; i < 25; i++) {
    const n = await page.evaluate(() => document.querySelectorAll('.report-table .el-table__body tr').length)
    if (n > 0) return n
    await page.waitForTimeout(1000)
  }
  return 0
}
async function restoreWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

/** 在落点面板里找「哪里有这个单号」:输入框 value / textarea / 文本节点 */
function findDocNoInPage(no) {
  const hits = []
  for (const el of document.querySelectorAll('input, textarea')) {
    const v = String(el.value || '')
    if (v.includes(no)) hits.push({ where: 'input', cls: el.className, placeholder: el.placeholder || '', value: v })
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    if ((node.nodeValue || '').includes(no)) {
      hits.push({ where: 'text', cls: node.parentElement?.className || '', value: (node.nodeValue || '').trim() })
      if (hits.length > 12) break
    }
  }
  return hits.slice(0, 12)
}

const out = { rounds: [] }
for (const rowIdx of [0, 2]) {
  await openList()
  const picked = await page.evaluate((idx) => {
    const tr = document.querySelectorAll('.report-table .el-table__body tr')[idx]
    const cells = [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim())
    const docLink = [...tr.querySelectorAll('.doc-no-link')][0]
    docLink.click()
    return { docNo: cells[2], workOrderNo: cells[3], clicked: docLink.textContent.trim() }
  }, rowIdx)
  await page.waitForTimeout(4500)
  await restoreWin()
  const res = await page.evaluate(findDocNoInPage, picked.docNo)
  out.rounds.push({
    rowIdx,
    ...picked,
    hash: await page.evaluate(() => location.hash),
    title: await page.evaluate(() => document.title),
    docNoHits: res.length,
    hits: res,
    located: res.length > 0,
  })
  if (rowIdx === 0) await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detaillink-20261123/round-03-doc-located.png' })
}
console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: [] })
