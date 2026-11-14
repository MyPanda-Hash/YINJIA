/**
 * 第 4 轮 · 前端「连点不重复发请求」的界面取证(2026-11-12)
 *
 * 做法:用 CDP 给页面加 5s 网络延迟,让这次「转ERP」请求一直在飞,然后 150ms 内连点两次。
 *   期望 ① 第二下被拦下(按钮已置灰),提示文案 = 新增的 ERP_BUSY_KEY;
 *   期望 ② 页面只发出 **1** 个 /px/callButton 请求(用 XHR 打点计数,不经服务端);
 *   期望 ③ 收尾把延迟恢复,让这次请求自己走完(当前选中的是草稿单,服务端必然回「仅已审核…」,
 *          不产生任何金蝶单据 —— 这次只验前端,不推单)。
 */
const OUT = 'C:/Users/Lenovo/ego/erp-dedup-20261112'
const task = await taskSpace('erp-dedup-20261112')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

// ① XHR 打点:记录每一次被真正发出的请求(axios 走 XHR)
await page.evaluate(() => {
  window.__calls = []
  if (!window.__xhrPatched) {
    window.__xhrPatched = true
    const origOpen = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (m, u) {
      try { window.__calls.push({ m, u: String(u), t: Date.now() }) } catch (e) {}
      return origOpen.apply(this, arguments)
    }
  }
})

// ② 加 5 秒网络延迟(让请求"一直在飞")
await page.cdp('Network.enable', {})
await page.cdp('Network.emulateNetworkConditions', {
  offline: false, latency: 5000, downloadThroughput: 10 * 1024 * 1024, uploadThroughput: 10 * 1024 * 1024,
})

const res = await page.evaluate(async () => {
  window.__calls = []
  const erpBtn = () => [...document.querySelectorAll('.tb-main')].find((el) => (el.textContent || '').trim() === '转ERP')
  const b1 = erpBtn()
  if (!b1) return { ok: false, why: '找不到转ERP按钮' }
  b1.click()
  await new Promise((r) => setTimeout(r, 150))
  const b2 = erpBtn()
  const greyedOnSecondClick = b2 ? b2.classList.contains('disabled') : null
  if (b2) b2.click()
  await new Promise((r) => setTimeout(r, 600))
  return {
    ok: true,
    greyedOnSecondClick,
    calls: window.__calls.filter((c) => String(c.u).includes('/callButton')).length,
    messages: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
  }
})
console.log('连点结果 =', JSON.stringify(res, null, 2))
await restoreWindow()
await page.screenshot({ path: `${OUT}/round-04-busy.png` })

// ③ 恢复网络,让这一个请求自己走完
await page.cdp('Network.emulateNetworkConditions', {
  offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
})
await page.waitForTimeout(8000)
const after = await page.evaluate(() => ({
  calls: window.__calls.filter((c) => String(c.u).includes('/callButton')).length,
  messages: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('收尾 =', JSON.stringify(after, null, 2))
await page.screenshot({ path: `${OUT}/round-04-after.png` })
