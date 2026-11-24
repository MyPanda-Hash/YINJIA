// round-02.mjs —— 点「单据编号」跳出货检验单 + 点「工单号」跳生产工单并定位该行(2026-11-23)
// 判据:
//   A. 单据编号 → 路由变成 /panelx/list/QC_ASM_INSP,且页面里出现被点的那张单号(不是列表第一张)
//   B. 工单号   → 路由变成 /prod/plan/workOrderList,关键词 = 工单号,且该工单行被选中 + 打开「工单详情·追溯」
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

function restoreWin() {
  return (async () => {
    try {
      const w = await page.cdp('Browser.getWindowForTarget', {})
      if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
      await page.waitForTimeout(500)
    } catch (e) { console.log('restore skip: ' + e.message) }
  })()
}

const out = { steps: [] }

/* ───── A. 点单据编号 ───── */
await openList()
const before = await page.evaluate(() => {
  const tr = document.querySelector('.report-table .el-table__body tr')
  const link = tr?.querySelector('.doc-no-link')
  const cells = tr ? [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim()) : []
  return { docNo: cells[2] || '', workOrderNo: cells[3] || '', linkText: link?.textContent?.trim() || '', linkCount: tr ? tr.querySelectorAll('.doc-no-link').length : 0 }
})
out.steps.push({ step: 'A0 取第一行要点的单号', ...before })

await page.evaluate(() => {
  const tr = document.querySelector('.report-table .el-table__body tr')
  const links = [...tr.querySelectorAll('.doc-no-link')]
  // 第 1 个链接 = 单据编号列(第 2 个 = 工单号)
  links[0].click()
})
await page.waitForTimeout(4500)
await restoreWin()
const afterDoc = await page.evaluate(() => {
  const text = (document.body.innerText || '').replace(/\s+/g, ' ')
  return {
    hash: location.hash,
    title: document.title,
    docNoOnPage: (text.match(/[A-Z]{2}-\d{4}-\d{2}-\d{4}/g) || []).slice(0, 6),
    // 纸面(QcProcInspSheet)标题:出货检验表观记录表
    sheetTitle: (document.querySelector('.qr-sheet .qr-title, .qr-sheet h3, .qr-sheet .as-title')?.innerText || '').trim(),
    hasSheet: !!document.querySelector('.qr-sheet'),
  }
})
out.steps.push({ step: 'A1 点单据编号后的落点', ...afterDoc, expectDocNo: before.docNo, hit: afterDoc.docNoOnPage.includes(before.docNo) })
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detaillink-20261123/round-02-A-doc-jump.png' })

/* ───── B. 点工单号 ───── */
await openList()
const beforeB = await page.evaluate(() => {
  const tr = document.querySelector('.report-table .el-table__body tr')
  const cells = tr ? [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim()) : []
  return { docNo: cells[2] || '', workOrderNo: cells[3] || '' }
})
await page.evaluate(() => {
  const tr = document.querySelector('.report-table .el-table__body tr')
  const links = [...tr.querySelectorAll('.doc-no-link')]
  links[1].click()
})
await page.waitForTimeout(6000)
await restoreWin()
const afterWo = await page.evaluate(() => {
  const kw = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('工单号') || (i.placeholder || '').includes('搜索'))
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const currentRow = document.querySelector('.el-table__body tr.current-row')
  return {
    hash: location.hash,
    title: document.title,
    keyword: kw ? kw.value : '',
    dialogs: dlg.map((d) => (d.querySelector('.el-dialog__title')?.innerText || '').trim()),
    currentRowText: currentRow ? (currentRow.innerText || '').replace(/\s+/g, ' ').trim() : '',
    rowCount: document.querySelectorAll('.el-table__body tr').length,
  }
})
out.steps.push({
  step: 'B1 点工单号后的落点',
  ...afterWo,
  expectWorkOrder: beforeB.workOrderNo,
  keywordHit: afterWo.keyword === beforeB.workOrderNo,
  rowHit: afterWo.currentRowText.includes(beforeB.workOrderNo),
})
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-detaillink-20261123/round-02-B-workorder-jump.png' })

console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: [] })
