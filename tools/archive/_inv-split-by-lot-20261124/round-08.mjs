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

// 生产退料单据页:扫一个多批次物料 → 看批次明细小表(本次分摊)
await page.goto(`${BASE}/#/panelx/list/MOBILE_RETURN/doc?id=856`, { timeout: 60000 })
await page.waitForTimeout(5000)
await page.fill("loc=css:input[placeholder='扫物料码或输入物料编码']", "YJ-XWR-058")
await page.click("text=查询", { label: "查询可退量" })
await page.waitForTimeout(3000)
const scanState = await page.evaluate(() => {
  const batches = [...document.querySelectorAll(".mp-batch-row")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
  const cur = document.querySelector(".mp-mat") ? document.querySelector(".mp-mat").textContent.replace(/\s+/g, " ").trim() : ""
  const qtyInput = [...document.querySelectorAll("input")].map((i) => i.value).filter(Boolean)
  return { batches, cur, qtyInput: qtyInput.slice(0, 6) }
})
console.log("退料扫多批次:", JSON.stringify(scanState, null, 2))
await restore()
await page.screenshot({ path: `${OUT}/06-return-scan-batches.png`, fullPage: true })

// 生产领料单据页(重看:明细行现在应带「仓库」)
await page.goto(`${BASE}/#/panelx/list/MOBILE_PICK/doc?id=856`, { timeout: 60000 })
await page.waitForTimeout(4500)
const pickLines = await page.evaluate(() =>
  [...document.querySelectorAll(".mp-line")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()))
console.log("生产领料明细行:", JSON.stringify(pickLines.slice(0, 4), null, 2))
await restore()
await page.screenshot({ path: `${OUT}/07-pick-doc-warehouse.png`, fullPage: true })
