// round-12 — 复核:①点记录单号是否打开【那一张】记录 ②已作废时提示文案(轮询抓消息)
const BASE = 'http://localhost:5173'
const task = await taskSpace('qc rec detail index link prod')
const page = task.page('p1')

async function pollMsgs(ms) {
  const seen = new Set()
  const end = Date.now() + ms
  while (Date.now() < end) {
    const now = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
    now.forEach((m) => seen.add(m))
    await page.waitForTimeout(120)
  }
  return [...seen]
}
async function docNoShown() {
  return await page.evaluate(() => {
    const m = document.body.innerText.match(/单据：([^\s]+)/)
    return m ? m[1] : ''
  })
}

// ① 点「检验数据记录单号」→ 应该是【那一张】记录
await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 120000 })
await page.waitForTimeout(6000)
const target = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.doc-no-link')].find((e) => /^JYSJ/.test(e.innerText.trim()))
  if (!el) return ''
  const no = el.innerText.trim()
  el.click()
  return no
})
await page.waitForTimeout(5000)
console.log('① 点击单号=' + target + ' 落地=' + await docNoShown() + ' url=' + await page.url())

// ② 已作废单(库里有行 + doc_status 已作废 ⇒ 列表不显示):提示 + 不落空表
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2026-10-0036', { timeout: 120000 })
const msgs2 = await pollMsgs(6000)
console.log('② 已作废 消息=' + JSON.stringify(msgs2) + ' 落地=' + await docNoShown() + ' 行数=' + await page.evaluate(() => {
  const t = [...document.querySelectorAll('table')].find((x) => x.querySelectorAll('tbody tr').length > 0)
  return t ? t.querySelectorAll('tbody tr').length : 0
}))

// ③ 真不存在的单号:兜底文案
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2099-01-9999', { timeout: 120000 })
const msgs3 = await pollMsgs(6000)
console.log('③ 不存在 消息=' + JSON.stringify(msgs3))
await page.screenshot({ path: 'D:/YINJIA-main/_scratch/qc-link-20261124/round-12-missing.png' })
