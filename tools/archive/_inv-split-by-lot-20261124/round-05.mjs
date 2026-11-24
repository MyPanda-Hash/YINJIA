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

// ① 手机端 · 生产领料单据页(已完成的那张:LL-2026-11-0047)
await page.goto(`${BASE}/#/panelx/list/MOBILE_PICK/doc?id=856`, { timeout: 60000 })
await page.waitForTimeout(5000)
const pickDoc = await page.evaluate(() => {
  const kv = [...document.querySelectorAll(".mp-kv")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
  const lines = [...document.querySelectorAll(".mp-line")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
  return { hash: location.hash, kv, lines, body: document.body.innerText.replace(/\s+/g, " ").slice(0, 900) }
})
console.log("生产领料单据页:", JSON.stringify(pickDoc, null, 2))
await restore()
await page.screenshot({ path: `${OUT}/03-mobile-pick-doc.png`, fullPage: true })

// ② 手机端 · 生产退料单据页(同一张单:应显示退料单号 TL-2026-11-0021)
await page.goto(`${BASE}/#/panelx/list/MOBILE_RETURN/doc?id=856`, { timeout: 60000 })
await page.waitForTimeout(5000)
const retDoc = await page.evaluate(() => {
  const kv = [...document.querySelectorAll(".mp-kv")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
  const lines = [...document.querySelectorAll(".mp-line")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
  return { hash: location.hash, kv, lines, body: document.body.innerText.replace(/\s+/g, " ").slice(0, 900) }
})
console.log("生产退料单据页:", JSON.stringify(retDoc, null, 2))
await restore()
await page.screenshot({ path: `${OUT}/04-mobile-return-doc.png`, fullPage: true })

// ③ 手机端 · 生产退料列表(应看到 退料单号)
await page.goto(`${BASE}/#/panelx/list/MOBILE_RETURN`, { timeout: 60000 })
await page.waitForTimeout(4500)
const retList = await page.evaluate(() => ({
  hash: location.hash,
  cards: [...document.querySelectorAll(".mr-doc")].slice(0, 4).map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()),
  body: document.body.innerText.replace(/\s+/g, " ").slice(0, 700),
}))
console.log("生产退料列表:", JSON.stringify(retList, null, 2))
await restore()
await page.screenshot({ path: `${OUT}/05-mobile-return-list.png`, fullPage: true })
