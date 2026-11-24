const task = await taskSpace("pick-split-batches-20261124")
const page = task.page("p1")
const BASE = "http://127.0.0.1:8090"
const OUT = "C:/Users/Lenovo/ego/pick-split-batches-20261124"

async function restore() {
  try {
    const w = await page.cdp("Browser.getWindowForTarget", {})
    if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } })
    await page.waitForTimeout(600)
  } catch (e) { console.log("restore skip: " + e.message) }
}

// 生产领料单 面板列表
await page.goto(`${BASE}/#/panelx/list/MATERIAL_OUT`, { timeout: 60000 })
await page.waitForTimeout(5000)
const panel = await page.evaluate(() => {
  const txt = (sel) => [...document.querySelectorAll(sel)].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean)
  return {
    hash: location.hash,
    th: txt(".el-table__header th").slice(0, 20),
    crumbs: txt(".el-breadcrumb__item, .crumb, .page-head").slice(0, 5),
    bodyHasNew: document.body.innerText.includes("生产领料单"),
    bodyHasOld: document.body.innerText.includes("材料出库单"),
  }
})
console.log("列表:", JSON.stringify(panel, null, 2))
await restore()
await page.screenshot({ path: `${OUT}/01-panel-list.png`, fullPage: false })

// 打开单据 LL-2026-11-0047(搜索框输入单号 → 查询)
try {
  const input = await page.evaluate(() => {
    const el = [...document.querySelectorAll("input")].find((i) => /搜索|单号|关键字|查询/.test(i.placeholder || ""))
    return el ? (el.placeholder || "") : ""
  })
  console.log("查询框 placeholder:", input)
} catch (e) { console.log("query probe:", e.message) }
