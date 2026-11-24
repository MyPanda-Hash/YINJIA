// round-06.mjs —— 边界 D:工单行id 为 NULL 的老单(工单行号=0,plang 无对应行)点「工单号」仍能跳
// 做法:明细表按「单据编号」升序排序(ZJ-2026-10-0006 排在最前),找到该行点工单号;
// 预期:路由到生产工单页;因没有行 id 只带关键字 ⇒ 不自动打开追溯,但列表被关键字过滤到该工单。
const task = await taskSpace('qc-detaillink-20261123')
const page = task.page('p1')
const ASM = 'http://localhost:5173/#/panelx/list/QC_ASM_INSP_DETAIL'
const SHOT = 'C:/Users/vigna/ego/qc-detaillink-20261123'

const inputs = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.placeholder || ''))
await page.goto(ASM, { timeout: 30000 })
await page.waitForTimeout(2500)
if (inputs.some((p) => p.includes('账号')) || (await page.evaluate(() => [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号'))))) {
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
  await page.goto(ASM, { timeout: 30000 })
}
for (let i = 0; i < 25; i++) {
  const n = await page.evaluate(() => document.querySelectorAll('.report-table .el-table__body tr').length)
  if (n > 0) break
  await page.waitForTimeout(1000)
}

// 点「单据编号」列头排序器切到升序(第一下=升序;再看首页首行是不是 ZJ-2026-10-xxxx)
const sortState = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const heads = [...table.querySelectorAll('.el-table__header th')]
  const target = heads.find((th) => (th.innerText || '').includes('单据编号'))
  const sorter = target?.querySelector('.report-col-sorter')
  if (sorter) { sorter.click(); return 'clicked-once' }
  return 'no-sorter'
})
await page.waitForTimeout(4000)
let sortedInfo = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
  const i = heads.indexOf('单据编号')
  return [...table.querySelectorAll('.el-table__body tr')].slice(0, 5).map((tr) => (tr.children[i]?.innerText || '').trim())
})
// 若不是升序(首行不是 10 月),再点一次
if (!sortedInfo.some((v) => v.startsWith('ZJ-2026-10'))) {
  await page.evaluate(() => {
    const table = document.querySelector('.report-table')
    const heads = [...table.querySelectorAll('.el-table__header th')]
    const target = heads.find((th) => (th.innerText || '').includes('单据编号'))
    target?.querySelector('.report-col-sorter')?.click()
  })
  await page.waitForTimeout(4000)
  sortedInfo = await page.evaluate(() => {
    const table = document.querySelector('.report-table')
    const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
    const i = heads.indexOf('单据编号')
    return [...table.querySelectorAll('.el-table__body tr')].slice(0, 5).map((tr) => (tr.children[i]?.innerText || '').trim())
  })
}

const out = { sortState, firstFive: sortedInfo, found: false }
const picked = await page.evaluate(() => {
  const table = document.querySelector('.report-table')
  const heads = [...table.querySelectorAll('.el-table__header th')].map((th) => (th.innerText || '').replace(/[⇅\s]/g, ''))
  const iDoc = heads.indexOf('单据编号')
  const iWo = heads.indexOf('工单号')
  const tr = [...table.querySelectorAll('.el-table__body tr')].find((x) => (x.children[iDoc]?.innerText || '').trim() === 'ZJ-2026-10-0006')
  if (!tr) return null
  const woCell = tr.children[iWo]
  const no = (woCell.innerText || '').trim()
  const hasLink = !!woCell.querySelector('.doc-no-link')
  woCell.querySelector('.doc-no-link')?.click()
  return { docNo: 'ZJ-2026-10-0006', wo: no, hasLink }
})
out.picked = picked
if (picked) {
  await page.waitForTimeout(8000)
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  out.landing = await page.evaluate(() => {
    const cur = document.querySelector('.el-table__body tr.current-row')
    const kw = [...document.querySelectorAll('input')].filter((i) => i.offsetParent !== null).map((i) => i.value).filter(Boolean)
    return {
      hash: location.hash,
      title: document.title,
      dialogs: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => (d.querySelector('.el-dialog__title')?.innerText || '').trim()),
      visibleInputs: kw.slice(0, 8),
      rowCount: document.querySelectorAll('.el-table__body tr').length,
      firstRow: (document.querySelector('.el-table__body tr')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50),
      currentRow: cur ? (cur.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50) : '',
    }
  })
  await page.screenshot({ path: SHOT + '/round-06-D-null-line-jump.png' })
}
console.log(JSON.stringify(out, null, 2))
await task.finish({ keep: [] })
