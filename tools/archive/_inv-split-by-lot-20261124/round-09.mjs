const task = await taskSpace("pick-split-batches-20261124")
const page = task.page("p1")
const BASE = "http://127.0.0.1:8090"
const OUT = "C:/Users/Lenovo/ego/pick-split-batches-20261124"

async function restore() {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {})
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } })
    await page.waitForTimeout(500)
  } catch (e) { console.log("restore skip: " + e.message) }
}

// 禁缓存后重进:确认拿到的是最新打包产物
await page.cdp("Network.setCacheDisabled", { cacheDisabled: true })
await page.goto(`${BASE}/#/panelx/list/MOBILE_PICK/doc?id=856&t=${Date.now()}`, { timeout: 60000 })
await page.reload()
await page.waitForTimeout(3000)
await page.goto(`${BASE}/#/panelx/list/MOBILE_PICK/doc?id=856`, { timeout: 60000 })
await page.waitForTimeout(5000)

const pickLines = await page.evaluate(() =>
  [...document.querySelectorAll(".mp-line")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()))
console.log("生产领料明细行:", JSON.stringify(pickLines.slice(0, 4), null, 2))
await restore()
await page.screenshot({ path: `${OUT}/07-pick-doc-warehouse.png`, fullPage: true })
