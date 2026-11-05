// round-55: 只有一个「扫码」按钮;点它直接进多选确认(假桥验证网页侧接线)
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')
await page.cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: "window.YjNative={scan:function(){window.__scanCalled=true},scanMulti:function(){window.__scanMultiCalled=true},getBaseUrl:function(){return ''},appVersion:function(){return '1.0.4'}};",
})
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK_CREATE', { timeout: 30000 })
await page.reload()
await page.waitForTimeout(4000)

console.log(JSON.stringify(await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  return { buttons: q('.mp-row button'), hints: q('.mp-hint') }
}), null, 2))

// 点唯一的「扫码」→ 应该调 scanMulti(不是 scan)
console.log(JSON.stringify(await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.mp-row button')].find((b) => (b.textContent || '').trim() === '扫码')
  if (btn) btn.click()
  return { clicked: !!btn, scanMultiCalled: !!window.__scanMultiCalled, scanCalled: !!window.__scanCalled }
}), null, 2))

// 模拟回传 3 张(含 1 个重复)
console.log(JSON.stringify(await page.evaluate(() => {
  window.__yjScanResultMulti(['0@GD-2026-11-0018@1001', '0@GD-2026-11-0017@1003', '0@GD-2026-11-0016@1001', '0@GD-2026-11-0018@1001'])
  return { ok: (document.querySelector('.mp-ok') || {}).textContent }
}), null, 2))
await page.waitForTimeout(600)
console.log(JSON.stringify(await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  return { queueRows: q('.mp-queue-row'), genBtn: q('.mp-gen button') }
}), null, 2))
try {
  const shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/create-single-scan-btn.png' })
  console.log({ shot })
} catch (e) { console.log('shot fail: ' + e.message) }
