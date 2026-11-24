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

// 退出 → 用测试账套重新登录
await page.goto(`${BASE}/#/login`, { timeout: 60000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.goto(`${BASE}/#/login`, { timeout: 60000 })
await page.reload()
await page.waitForTimeout(3500)

const loginProbe = await page.evaluate(() => ({
  inputs: [...document.querySelectorAll("input")].map((i) => i.placeholder || i.value || ""),
  selects: [...document.querySelectorAll(".el-select, .el-input__inner")].map((e) => (e.textContent || e.value || "").trim()).slice(0, 8),
  buttons: [...document.querySelectorAll("button")].map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 8),
  body: document.body.innerText.replace(/\s+/g, " ").slice(0, 300),
}))
console.log("登录页:", JSON.stringify(loginProbe, null, 2))
