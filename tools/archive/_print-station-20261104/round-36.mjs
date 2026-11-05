// round-36: 8090(打包后的 jar)复核「自动打印」页 —— 确认部署产物也生效
const task = await taskSpace(1)
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/sys/printStation', { timeout: 40000 })
await page.waitForTimeout(4500)
console.log(JSON.stringify(await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    entry: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')).filter(Boolean).join(','),
    title: q('.ps-title'), sub: q('.ps-sub'), badge: q('.ps-badge'),
    secs: q('.ps-sec'), stations: q('.ps-station'), kvs: q('.ps-kv').slice(0, 3),
  }
}), null, 2))
