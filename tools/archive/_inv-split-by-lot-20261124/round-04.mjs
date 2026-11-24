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

await page.goto(`${BASE}/#/panelx/list/MATERIAL_OUT`, { timeout: 60000 })
await page.waitForTimeout(4500)

// 模糊搜索里输入单号 → 查询
await page.fill("loc=css:input[placeholder='模糊搜索']", "LL-2026-11-0047")
await page.click("text=查询", { label: "查询单号" })
await page.waitForTimeout(3500)

const list = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".el-table__row")].map((r) =>
    [...r.querySelectorAll("td")].map((c) => (c.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean))
  return { count: rows.length, rows: rows.slice(0, 6) }
})
console.log("查询结果:", JSON.stringify(list, null, 2))

// 点第一行打开单据
if (list.count > 0) {
  await page.click("loc=css:.el-table__row", { label: "打开单据" })
  await page.waitForTimeout(4000)
  const doc = await page.evaluate(() => {
    const t = (sel) => [...document.querySelectorAll(sel)].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean)
    return {
      hash: location.hash,
      head: t(".el-form-item__label, .form-label, label").slice(0, 30),
      values: [...document.querySelectorAll(".el-form-item__content input")].map((i) => i.value).slice(0, 20),
      bodyText: document.body.innerText.replace(/\s+/g, " ").slice(0, 1200),
    }
  })
  console.log("单据详情:", JSON.stringify(doc, null, 2))
  await restore()
  await page.screenshot({ path: `${OUT}/02-doc-detail.png` })
}
