const task = await taskSpace("pick-split-batches-20261124")
const page = task.page("p1")
const BASE = "http://127.0.0.1:8090"

await page.goto(`${BASE}/#/panelx/list/MATERIAL_OUT`, { timeout: 60000 })
await page.waitForTimeout(5000)

const dom = await page.evaluate(() => {
  const vis = (el) => el && el.offsetParent !== null
  const inputs = [...document.querySelectorAll("input")].filter(vis).map((i) => ({
    ph: i.placeholder || "", val: i.value || "", cls: (i.className || "").slice(0, 40),
  }))
  const btns = [...document.querySelectorAll("button")].filter(vis).map((b) => (b.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean)
  const tabs = [...document.querySelectorAll(".el-tabs__item")].filter(vis).map((t) => (t.textContent || "").trim())
  return { inputs: inputs.slice(0, 20), btns: btns.slice(0, 40), tabs }
})
console.log(JSON.stringify(dom, null, 2))
