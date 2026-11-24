// round-11 — 三种落点各点一次:①真跳转(存在的单)②已作废 ③不存在
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')

async function state() {
  return await page.evaluate(() => {
    const bodyTbl = [...document.querySelectorAll('table')].find((t) => t.querySelectorAll('tbody tr').length > 0)
    const firstRow = bodyTbl ? (bodyTbl.querySelector('tbody tr').innerText || '').replace(/\s+/g, ' ').slice(0, 80) : ''
    return {
      url: location.href,
      docText: (document.body.innerText.match(/单据：[^\s]{0,30}/) || [''])[0],
      rows: bodyTbl ? bodyTbl.querySelectorAll('tbody tr').length : 0,
      firstRow,
      msgs: [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()),
      empty: (document.body.innerText.includes('暂无数据') || document.body.innerText.includes('暂无符合条件的数据')),
    }
  })
}

// ① 明细表里点「检验数据记录单号」(JYSJ-2026-09-0048,记录存在 ⇒ 应真跳过去并定位)
await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 120000 })
await page.waitForTimeout(6000)
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.doc-no-link')].find((e) => /^JYSJ/.test(e.innerText.trim()))
  if (!el) return 'NO-LINK'
  const no = el.innerText.trim()
  el.click()
  return no
})
await page.waitForTimeout(6000)
console.log('① 记录单号=' + clicked + ' → ' + JSON.stringify(await state()))

// ② 已作废:IJ-2026-10-0036(库里有行、doc_status 已作废 ⇒ 列表不显示)
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2026-10-0036', { timeout: 120000 })
await page.waitForTimeout(7000)
console.log('② 已作废 → ' + JSON.stringify(await state()))
await page.screenshot({ path: OUT + '/round-11-voided.png' })

// ③ 不存在:IJ-2026-09-0152
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2026-09-0152', { timeout: 120000 })
await page.waitForTimeout(7000)
console.log('③ 不存在 → ' + JSON.stringify(await state()))
await page.screenshot({ path: OUT + '/round-11-missing.png' })

// ④ 正常存在:IJ-2026-10-0020 ⇒ 应定位到该单(单据：IJ-2026-10-0020)
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2026-10-0020', { timeout: 120000 })
await page.waitForTimeout(7000)
console.log('④ 存在 → ' + JSON.stringify(await state()))
await page.screenshot({ path: OUT + '/round-11-ok.png' })
