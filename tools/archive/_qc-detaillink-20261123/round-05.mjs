// round-05.mjs —— 全量验收取证(2026-11-23):
//  A. 表观明细表:点「单据编号」(已审核单 ZJ-2026-11-0009)→ 落到出货检验（表观）并显示该单
//  B. 表观明细表:点「工单号」→ 生产工单页 + 关键词 + 该工单行选中 + 自动打开「工单详情 · 追溯」
//  C. 功能明细表(QC_PROC_INSP_DETAIL):两列链接存在;点「单据编号」→ 出货检验（功能）并显示该单
//  D. 边界:工单行id 对不上(老单 GD-2026-10-0002)时点「工单号」仍能跳(只带关键字、不硬定位)
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const ASM = 'http://localhost:5173/#/panelx/list/QC_ASM_INSP_DETAIL'
const PROC = 'http://localhost:5173/#/panelx/list/QC_PROC_INSP_DETAIL'
const SHOT = 'C:/Users/vigna/ego/qc-detaillink-20261123'

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
async function openUrl(url) {
  await page.goto(url, { timeout: 30000 })
  await page.waitForTimeout(2500)
  if (await loginIfNeeded()) { await page.goto(url, { timeout: 30000 }); await page.waitForTimeout(5000) }
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
/** 明细表:按列头文字取某行某列的值 + 该格是否链接 */
function rowProbe() {
  const table = document.querySelector('.report-table')
  const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
  const rows = [...table.querySelectorAll('.el-table__body tr')]
  const idx = (name) => heads.indexOf(name)
  const cellOf = (tr, name) => {
    const i = idx(name)
    return i < 0 ? { value: '', link: false } : { value: (tr.children[i].innerText || '').trim(), link: !!tr.children[i].querySelector('.doc-no-link') }
  }
  return { heads, idxDoc: idx('单据编号'), idxWo: idx('工单号'), rows, cellOf }
}
/** 落点面板里找单号:输入框 value / 文本节点(§5⑥:el-input 的值不进 innerText) */
function findDocNo(no) {
  const hits = []
  for (const el of document.querySelectorAll('input, textarea')) {
    const v = String(el.value || '')
    if (v.includes(no)) hits.push({ where: 'input', value: v })
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    const t = (node.nodeValue || '').trim()
    if (t.includes(no)) hits.push({ where: 'text', cls: node.parentElement?.className || '', value: t })
    if (hits.length > 10) break
  }
  return hits.slice(0, 10)
}

const out = {}

/* ───── A. 表观:点单据编号 ───── */
await openUrl(ASM)
out.A_list = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const tr = table.querySelector('.el-table__body tr')
  const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
  const cells = [...tr.querySelectorAll('td')].map((td) => ({ v: (td.innerText || '').trim(), link: !!td.querySelector('.doc-no-link') }))
  return {
    rowCount: table.querySelectorAll('.el-table__body tr').length,
    linkColumns: heads.filter((h, i) => cells[i]?.link),
    firstRow: { docNo: cells[heads.indexOf('单据编号')]?.v, wo: cells[heads.indexOf('工单号')]?.v },
  }
})
await restoreWin()
await page.screenshot({ path: SHOT + '/round-05-A1-detail-list.png' })
const pickedA = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
  const tr = table.querySelectorAll('.el-table__body tr')[0]
  const docCell = tr.children[heads.indexOf('单据编号')]
  const no = (docCell.innerText || '').trim()
  docCell.querySelector('.doc-no-link').click()
  return no
})
await page.waitForTimeout(9000)
await restoreWin()
out.A_jump = {
  picked: pickedA,
  hash: await page.evaluate(() => location.hash),
  title: await page.evaluate(() => document.title),
  hits: await page.evaluate(findDocNo, pickedA),
}
out.A_jump.hit = out.A_jump.hits.length > 0
await page.screenshot({ path: SHOT + '/round-05-A2-doc-opened.png' })

/* ───── B. 表观:点工单号 ───── */
await openUrl(ASM)
const pickedB = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
  const tr = table.querySelectorAll('.el-table__body tr')[0]
  const woCell = tr.children[heads.indexOf('工单号')]
  const no = (woCell.innerText || '').trim()
  woCell.querySelector('.doc-no-link').click()
  return no
})
await page.waitForTimeout(8000)
await restoreWin()
out.B_jump = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const cur = document.querySelector('.el-table__body tr.current-row')
  return {
    hash: location.hash,
    title: document.title,
    dialogs: dlg.map((d) => (d.querySelector('.el-dialog__title')?.innerText || '').trim()),
    currentRow: cur ? (cur.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60) : '',
  }
})
out.B_jump.picked = pickedB
out.B_jump.rowHit = out.B_jump.currentRow.includes(pickedB)
out.B_jump.traceOpened = out.B_jump.dialogs.some((t) => t.includes('追溯'))
await page.screenshot({ path: SHOT + '/round-05-B-workorder-trace.png' })

/* ───── C. 功能明细表:两列链接 + 点单据编号 ───── */
await openUrl(PROC)
out.C_list = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const tr = table.querySelector('.el-table__body tr')
  const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
  const cells = [...tr.querySelectorAll('td')].map((td) => ({ v: (td.innerText || '').trim(), link: !!td.querySelector('.doc-no-link') }))
  return { rowCount: table.querySelectorAll('.el-table__body tr').length, linkColumns: heads.filter((h, i) => cells[i]?.link), firstRow: { docNo: cells[heads.indexOf('单据编号')]?.v, wo: cells[heads.indexOf('工单号')]?.v } }
})
const pickedC = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
  const tr = table.querySelectorAll('.el-table__body tr')[0]
  const docCell = tr.children[heads.indexOf('单据编号')]
  const no = (docCell.innerText || '').trim()
  docCell.querySelector('.doc-no-link').click()
  return no
})
await page.waitForTimeout(9000)
await restoreWin()
out.C_jump = { picked: pickedC, hash: await page.evaluate(() => location.hash), title: await page.evaluate(() => document.title), hits: await page.evaluate(findDocNo, pickedC) }
out.C_jump.hit = out.C_jump.hits.length > 0
await page.screenshot({ path: SHOT + '/round-05-C-proc-doc-opened.png' })

/* ───── D. 边界:工单行id 对不上(null)时点工单号 ───── */
await openUrl(ASM)
// 跨页找「工单行id 为空」的那行:借后端关键字(单据编号)过滤,直接按 单据编号 ZJ-2026-10-0006 找
out.D = { note: 'ZJ-2026-10-0006 / GD-2026-10-0002 的 工单行号=0,plang 里没有对应行 ⇒ 视图 工单行id=NULL' }
// 用查询区「单据编号」条件定位该单:打开查询对话框不方便,这里改翻到末页找(按单据日期倒序,老单在最后)
let found = null
for (let p = 1; p <= 12 && !found; p++) {
  const has = await page.evaluate((docNo) => {
    const table = document.querySelector('.report-table')
    const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
    const i = heads.indexOf('单据编号')
    return [...table.querySelectorAll('.el-table__body tr')].some((tr) => (tr.children[i]?.innerText || '').trim() === docNo)
  }, 'ZJ-2026-10-0006')
  if (has) { found = p; break }
  const next = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.el-pager li, .btn-next, button')]
    const nx = document.querySelector('.btn-next')
    if (nx && !nx.disabled) { nx.click(); return true }
    const li = btns.find((b) => b.textContent.trim() === String((Number([...document.querySelectorAll('.el-pager li.is-active')][0]?.textContent || '1')) + 1))
    if (li) { li.click(); return true }
    return false
  })
  if (!next) break
  await page.waitForTimeout(2500)
}
out.D.pageFound = found
if (found) {
  out.D.picked = await page.evaluate(() => {
    const table = document.querySelector('.report-table')
    const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
    const tr = [...table.querySelectorAll('.el-table__body tr')].find((x) => (x.children[heads.indexOf('单据编号')]?.innerText || '').trim() === 'ZJ-2026-10-0006')
    const woCell = tr.children[heads.indexOf('工单号')]
    const no = (woCell.innerText || '').trim()
    woCell.querySelector('.doc-no-link').click()
    return no
  })
  await page.waitForTimeout(7000)
  await restoreWin()
  out.D.jump = await page.evaluate(() => ({ hash: location.hash, title: document.title, dialogVisible: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => (d.querySelector('.el-dialog__title')?.innerText || '').trim()) }))
  await page.screenshot({ path: SHOT + '/round-05-D-null-line-jump.png' })
}

console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: [] })
