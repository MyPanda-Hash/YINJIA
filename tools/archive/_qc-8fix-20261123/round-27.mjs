// round-27: 强制拿最新入口 chunk, 复核 QC_BHC 时间/目录
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p8')
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(8000)
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('BHC-2026-09-0001'))
  if (tr) tr.click()
})
await page.waitForTimeout(2500)
console.log(JSON.stringify(await page.evaluate(() => ({
  chunk: [...document.querySelectorAll('script')].map((s) => s.src).find((x) => x.includes('index-')),
  titleH: Math.round(document.querySelector('.as-title')?.getBoundingClientRect().height || 0),
  time: [...document.querySelectorAll('.as-info-row')].map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()).slice(-1)[0],
  rail: [...document.querySelectorAll('th')].map((x) => (x.innerText || '').trim()).filter((x) => ['单号', '日期', '产品编码', '审核状态', '客户名称'].includes(x)),
})), null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-27-final.png' })
