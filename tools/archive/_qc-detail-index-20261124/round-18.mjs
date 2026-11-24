// round-18 — 明细表两列各点一次(存在/不存在),并留取证截图
const OUT = 'D:/YINJIA-main/_scratch/qc-link-20261124'
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')

await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 120000 })
await page.waitForTimeout(7000)
await page.screenshot({ path: OUT + '/round-18-detail.png' })
const links = await page.evaluate(() => [...document.querySelectorAll('.doc-no-link')].slice(0, 6).map((e) => e.innerText.trim()))
console.log('first links: ' + JSON.stringify(links))

// ① 点第 1 行「来料检验单号」IJ-2026-09-0152(该单存在)
const hit = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.doc-no-link')].find((e) => /^IJ-/.test(e.innerText.trim()))
  if (!el) return ''
  const no = el.innerText.trim()
  el.click()
  return no
})
await page.waitForTimeout(6000)
const land1 = await page.evaluate(() => ({
  url: location.href,
  doc: (document.body.innerText.match(/单据：([^\s]+)/) || ['', ''])[1],
  rows: (() => { const t = [...document.querySelectorAll('table')].find((x) => x.querySelectorAll('tbody tr').length > 0); return t ? t.querySelectorAll('tbody tr').length : 0 })(),
}))
console.log('① 来料检验单号 ' + hit + ' → ' + JSON.stringify(land1))
await page.screenshot({ path: OUT + '/round-18-jump-insp.png' })

// ② 回到明细表,点第 1 行「检验数据记录单号」
await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 120000 })
await page.waitForTimeout(6000)
const hit2 = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.doc-no-link')].find((e) => /^JYSJ-/.test(e.innerText.trim()))
  if (!el) return ''
  const no = el.innerText.trim()
  el.click()
  return no
})
await page.waitForTimeout(6000)
const land2 = await page.evaluate(() => ({
  url: location.href,
  recNo: (document.body.innerText.match(/JYSJ-\d{4}-\d{2}-\d{4}/) || [''])[0],
  inspNo: (document.body.innerText.match(/IJ-\d{4}-\d{2}-\d{4}/) || [''])[0],
  hasSheet: document.body.innerText.includes('检验报告'),
}))
console.log('② 检验数据记录单号 ' + hit2 + ' → ' + JSON.stringify(land2))
await page.screenshot({ path: OUT + '/round-18-jump-rec.png' })
