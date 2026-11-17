/**
 * round-18(round-15 的重跑):去掉「撤回本项」后复核手机版面。
 * ⚠ 5173 是共用 dev 服务器,此刻**另一个会话**正在改 MobileLabRecord.vue,页面上残留了一个
 *   空的 `vite-error-overlay` 元素会吞掉指针事件 ⇒ 验证脚本先把它摘掉(只影响本地点击,不改被测代码)。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(400)

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN/doc?wo=GD-2026-11-0015&line=1', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })

await page.fill('input[placeholder*="扫物料码"]', 'YJ-TJHZ-001|20261118001')
await page.keyboard.press('Enter')
await page.waitForTimeout(1500)
await page.fill('.mp-qty input', '86.172')
await page.waitForTimeout(300)
await page.click('.mp-qty button:first-of-type')
await page.waitForTimeout(2200)

const layout = await page.evaluate(() => {
  const row = document.querySelector('.mp-line')
  return {
    rowText: row ? row.innerText.replace(/\s+/g, ' ').trim() : '',
    undoGone: !document.querySelector('.mp-line-undo'),
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    ok: (document.querySelector('.mp-ok') || {}).innerText || '',
    progress: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()).find((t) => t.startsWith('混料进度')) || '',
    submitDisabled: (() => { const b = document.querySelector('.mp-foot button'); return b ? !!b.disabled : null })(),
  }
})
console.log('== 已确认一行(390 宽) ==')
console.log(JSON.stringify(layout, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-18-mobile-confirmed.png', fullPage: true })

// 清理:接口撤回这次验证写入的那一笔(页面已无撤回按钮,undo 端点保留给老客户端)
const cleaned = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/mix/task?orderNo=GD-2026-11-0015&lineNo=1', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  const row = (j?.data?.明细 || []).find((l) => Number(l['实投']) > 0)
  if (!row || !row['行id']) return { cleaned: false, why: '没有已确认行' }
  const u = await fetch('/api/px/mix/undo', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ 行id: row['行id'] }),
  })
  return { cleaned: true, undo: await u.json() }
})
console.log('== 清理 ==')
console.log(JSON.stringify(cleaned, null, 2))

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
