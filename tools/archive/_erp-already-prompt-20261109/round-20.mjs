// round-20: 诊断 —— 列出采购入库单工具栏所有动作(找「弃审」),并确认当前单据/工厂
const task = await taskSpace('erp-already-prompt-20261109')
const page = task.page('p1')
try {
  await page.cdp('Network.enable', {})
  await page.cdp('Network.setCacheDisabled', { cacheDisabled: true })
} catch {}
await page.goto('http://127.0.0.1:8090/#/panelx/list/PURCHASE_IN', { timeout: 60000 })
await page.waitForTimeout(9000)
console.log(JSON.stringify(await page.evaluate(() => ({
  factory: (document.body.innerText.match(/(YINJIA-MES[^\n]{0,12})/) || [])[1],
  mainButtons: [...document.querySelectorAll('span.tb-main')].map((s) => (s.textContent || '').trim()),
  docNo: (document.body.innerText.match(/单据：(CGRK-[0-9-]+)/) || [])[1],
  status: [...document.querySelectorAll('.el-tag, .doc-status, [class*="status"]')].map((e) => (e.textContent || '').trim()).filter((t) => t && t.length < 8).slice(0, 10),
})), null, 2))
