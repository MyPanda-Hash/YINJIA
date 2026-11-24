// round-13 — 复核:①点记录单号打开的是不是【那一张】 ③不存在的单号仍是通用兜底(不再误报"草稿")
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

// ① 点「检验数据记录单号」→ 打开的是不是那一条(用单元格文本 + 落地面板里的单据编号输入值核对)
await page.goto(BASE + '/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 120000 })
await page.waitForTimeout(6000)
const target = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.doc-no-link')].find((e) => /^JYSJ/.test(e.innerText.trim()))
  if (!el) return ''
  const no = el.innerText.trim()
  el.click()
  return no
})
await page.waitForTimeout(6000)
const landed = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('input')].map((i) => String(i.value || '').trim()).filter(Boolean)
  return {
    url: location.href,
    hasNo: inputs.filter((v) => v.includes('JYSJ')),
    tableHasNo: document.body.innerText.includes('JYSJ'),
    bodySnippet: document.body.innerText.replace(/\s+/g, ' ').slice(0, 220),
  }
})
console.log('① 点击=' + target + ' → ' + JSON.stringify(landed))

// ③ 不存在的单号:仍是通用兜底
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2099-01-9999', { timeout: 120000 })
console.log('③ 不存在 消息=' + JSON.stringify(await pollMsgs(6000)))

// ② 再来一次已作废(确认改动后行为不变)
await page.goto(BASE + '/#/panelx/list/QC_INSP?docNo=IJ-2026-10-0036', { timeout: 120000 })
console.log('② 已作废 消息=' + JSON.stringify(await pollMsgs(6000)))
