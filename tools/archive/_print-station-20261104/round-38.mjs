// round-38: 认机信息(最近心跳/来源 IP)+ 新增电脑(登记 → 离线占位)
const task = await taskSpace(1)
const page = task.page('p1')
await page.reload()
await page.waitForTimeout(3000)
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 30000 })
await page.waitForTimeout(4500)

// ① 代理在线时:认机信息 + IP
console.log('--- 代理在线 ---')
console.log(JSON.stringify(await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/print/station', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    api: (j?.data?.stations || []).map((s) => ({ name: s.name, online: s.online, enabled: s.enabled, ip: s.ip, lastSeen: s.lastSeen })),
    uiRows: q('.ps-station'),
    uiMeta: q('.ps-station-meta'),
    hints: q('.ps-hint'),
  }
}), null, 2))

// ② 面板上「新增打印电脑」→ 登记一台还没装的电脑
await page.fill('loc=css:.ps-add input', '二车间打印点')
await page.waitForTimeout(300)
await page.click('loc=css:.ps-add button:has-text("添加")', { label: 'add station' })
await page.waitForTimeout(2500)
console.log('--- 新增一台(未连过)---')
console.log(JSON.stringify(await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  return { uiRows: q('.ps-station'), uiMeta: q('.ps-station-meta'), msg: q('.el-message') }
}), null, 2))
