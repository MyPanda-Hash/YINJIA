const task = await taskSpace("pick-split-batches-20261124")
const page = task.page("p1")
const BASE = "http://127.0.0.1:8090"
const OUT = "C:/Users/Lenovo/ego/pick-split-batches-20261124"

await page.goto(`${BASE}/#/login`, { timeout: 60000 })
await page.waitForTimeout(2500)

// 登录:admin / 123456,工厂 = 测试库
const loginState = await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    s.call(el, v)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }
  const ins = [...document.querySelectorAll("input")]
  const acc = ins.find((i) => (i.placeholder || "").includes("账号"))
  const pwd = ins.find((i) => (i.placeholder || "").includes("密码"))
  if (acc) setVal(acc, "admin")
  if (pwd) setVal(pwd, "123456")
  return { acc: !!acc, pwd: !!pwd, hash: location.hash }
})
console.log("登录页:", JSON.stringify(loginState))

// 选工厂 = 测试库(下拉)
try {
  await page.click("loc=css:input[placeholder*='工厂']", { label: "选择登录工厂" })
  await page.waitForTimeout(600)
  await page.click("text=YINJIA-MES·测试库", { label: "选测试账套" })
  await page.waitForTimeout(400)
} catch (e) {
  console.log("选工厂跳过:", e.message)
}

await page.click("text=进入系统", { label: "登录" })
await page.waitForTimeout(4000)
console.log("登录后:", await page.evaluate(() => ({ hash: location.hash, title: document.title })))

// 生产领料单面板列表
await page.goto(`${BASE}/#/panelx/list/MATERIAL_OUT`, { timeout: 60000 })
await page.waitForTimeout(4000)
const panel = await page.evaluate(() => {
  const txt = (sel) => [...document.querySelectorAll(sel)].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
  return {
    hash: location.hash,
    heads: txt(".el-table__header th, .el-table__header-wrapper th").slice(0, 16),
    titles: txt(".page-title, .panel-title, .title, h2, h3").slice(0, 6),
    hasMatOut: document.body.innerText.includes("生产领料单"),
    hasOld: document.body.innerText.includes("材料出库单"),
  }
})
console.log("生产领料单面板:", JSON.stringify(panel, null, 2))

try {
  const w = await page.cdp("Browser.getWindowForTarget", {})
  if (w && w.windowId) await task.cdp("Browser.setWindowBounds", { windowId: w.windowId, bounds: { windowState: "normal" } })
  await page.waitForTimeout(600)
} catch (e) { console.log("restore skip: " + e.message) }
await page.screenshot({ path: `${OUT}/01-panel-list.png` })
