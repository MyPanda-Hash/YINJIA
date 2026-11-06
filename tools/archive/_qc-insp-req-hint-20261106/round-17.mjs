const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

// 上一轮残留:hash 导航不会真正重载文档,弹窗还是旧数据 —— 这里强制 reload
await page.goto('http://localhost:5173/#/dashboard', { timeout: 45000 })
await page.reload({ timeout: 45000 })
await page.waitForTimeout(6000)
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-10-0084', { timeout: 45000 })
await page.waitForTimeout(7000)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-lib-btn')].find((n) => (n.textContent || '').includes('检验要求') && !(n.textContent || '').includes('带入'))
  if (el) el.click()
})
await page.waitForTimeout(5000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const out = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('来料检验要求'))
  if (!d) return { found: false }
  return {
    text: (d.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
    warn: [...d.querySelectorAll('.req-view-warn')].map((n) => n.textContent.trim()),
    tips: [...d.querySelectorAll('.req-view-tip')].map((n) => (n.innerText || '').trim()),
    tabLabels: [...d.querySelectorAll('.rsp-page-tab')].map((n) => (n.innerText || '').trim()),
  }
})
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-req-hint-20261106/round-17.png' })
