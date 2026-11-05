// round-54: 用假的 YjNative 桥验证网页侧「扫多张」按钮 + 多码回调入队
const task = await taskSpace('pick-main-material-20261104')
const page = task.page('p1')

// 在页面脚本运行前注入桥(模拟新版 APK;不下发真相机,只验证按钮与回调)
await page.cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: "window.YjNative={scan:function(){window.__scanCalled=true},scanMulti:function(){window.__scanMultiCalled=true},getBaseUrl:function(){return ''},appVersion:function(){return '1.0.3'}};",
})
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK_CREATE', { timeout: 30000 })
await page.reload()
await page.waitForTimeout(4000)

console.log(JSON.stringify(await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    hasBridge: !!(window.YjNative && window.YjNative.scanMulti),
    buttons: q('.mp-row button'),
    hints: q('.mp-hint'),
    multiCallbackBound: typeof window.__yjScanResultMulti,
  }
}), null, 2))

// 模拟原生多选回传 3 张工单
console.log(JSON.stringify(await page.evaluate(() => {
  window.__yjScanResultMulti(['0@GD-2026-11-0018@1001', '0@GD-2026-11-0017@1003', '0@GD-2026-11-0016@1001', '0@GD-2026-11-0016@1001'])
  return { queue: document.querySelectorAll('.mp-queue-row').length, ok: (document.querySelector('.mp-ok') || {}).textContent }
}), null, 2))
await page.waitForTimeout(500)
console.log(JSON.stringify(await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  return { queueRows: q('.mp-queue-row'), genBtn: q('.mp-gen button') }
}), null, 2))
try {
  const shot = await page.screenshot({ path: 'C:/Users/Lenovo/ego/pick-main-material-20261104/create-scan-multi.png' })
  console.log({ shot })
} catch (e) { console.log('shot fail: ' + e.message) }
