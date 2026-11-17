// round-12.mjs — ①「自动打印」页出现「混料单」类型; ②/px/mix/doc 的纸面载荷(计划→请领、实际→实发)
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')

// ① 打印站点:勾选类型里应能看到「混料单」
await page.goto('http://127.0.0.1:8090/#/sys/printStation', { timeout: 40000 })
await page.waitForTimeout(4000)
const types = await page.evaluate(() => ({
  hash: location.hash,
  labels: [...document.querySelectorAll('label, .el-checkbox__label')]
    .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t && t.length <= 12),
}))
console.log('自动打印页可见标签:', JSON.stringify(types, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r12-printstation.png' })

// ② 纸面载荷:用页面里的登录态直接打 /api/px/mix/doc
const doc = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/mix/doc?docNo=PL2611160001', { headers: { Authorization: 'Bearer ' + token } })
  return { status: r.status, body: await r.json().catch(() => null) }
})
console.log('doc payload:', JSON.stringify(doc, null, 2))
