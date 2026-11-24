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

// 填账号密码
await page.fill("loc=css:input[placeholder='请输入登录账号']", "admin")
await page.fill("loc=css:input[placeholder='请输入登录密码']", "123456")

// 打开「登录工厂」下拉 → 选测试账套
await page.click("text=YINJIA-MES", { label: "打开登录工厂" })
await page.waitForTimeout(900)
const opts = await page.evaluate(() => [...document.querySelectorAll(".el-select-dropdown__item, .el-option")]
  .map((e) => (e.textContent || "").trim()).filter(Boolean))
console.log("工厂选项:", JSON.stringify(opts))
const target = opts.find((o) => o.includes("测试")) || opts[1]
if (target) {
  await page.click(`text=${target}`, { label: "选测试账套" })
  await page.waitForTimeout(600)
}
await page.click("text=进入系统", { label: "登录" })
await page.waitForTimeout(5000)
console.log("登录后:", JSON.stringify(await page.evaluate(() => ({
  hash: location.hash,
  factory: (document.body.innerText.match(/YINJIA-MES[^\s|]*/g) || []).slice(0, 3),
})), null, 2))

// 手机端 · 生产领料单据页
await page.goto(`${BASE}/#/panelx/list/MOBILE_PICK/doc?id=856`, { timeout: 60000 })
await page.waitForTimeout(5000)
const pickDoc = await page.evaluate(() => {
  const kv = [...document.querySelectorAll(".mp-kv")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
  const lines = [...document.querySelectorAll(".mp-line")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
  return { kv, lines: lines.slice(0, 6) }
})
console.log("生产领料单据页:", JSON.stringify(pickDoc, null, 2))
await restore()
await page.screenshot({ path: `${OUT}/03-mobile-pick-doc.png`, fullPage: true })

// 手机端 · 生产退料列表 + 单据页
await page.goto(`${BASE}/#/panelx/list/MOBILE_RETURN`, { timeout: 60000 })
await page.waitForTimeout(4500)
const retList = await page.evaluate(() => ({
  cards: [...document.querySelectorAll(".mr-doc")].slice(0, 3).map((e) => (e.textContent || "").replace(/\s+/g, " ").trim()),
}))
console.log("生产退料列表:", JSON.stringify(retList, null, 2))
await restore()
await page.screenshot({ path: `${OUT}/05-mobile-return-list.png`, fullPage: true })

await page.goto(`${BASE}/#/panelx/list/MOBILE_RETURN/doc?id=856`, { timeout: 60000 })
await page.waitForTimeout(5000)
const retDoc = await page.evaluate(() => {
  const kv = [...document.querySelectorAll(".mp-kv")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
  const lines = [...document.querySelectorAll(".mp-line")].map((e) => (e.textContent || "").replace(/\s+/g, " ").trim())
  return { kv, lines: lines.slice(0, 6) }
})
console.log("生产退料单据页:", JSON.stringify(retDoc, null, 2))
await restore()
await page.screenshot({ path: `${OUT}/04-mobile-return-doc.png`, fullPage: true })
