// round-02: 生产 8090 打开立项申请列表 → 定位到有客户名的单据 → 取 DOM + Vue head
const task = await taskSpace(31)
const page = task.page("p1")
await page.goto("http://36.140.66.163:8090/#/panelx/list/RD_APPROVAL?docNo=LXA-2026-11-0017", { timeout: 30000 })
await page.waitForTimeout(4000)
console.log("url:", await page.url())

const info = await page.evaluate(() => {
  const out = { hasSheet: !!document.querySelector(".approval-sheet") }
  out.titles = [...document.querySelectorAll(".as-title")].map((e) => e.textContent.trim())
  // 客户名那一行的 DOM
  const rows = [...document.querySelectorAll(".approval-sheet .as-row")].map((r) => ({
    no: r.querySelector(".as-no")?.textContent?.trim() || "",
    name: r.querySelector(".as-name")?.textContent?.trim() || "",
    html: r.querySelector(".as-fill")?.innerHTML?.slice(0, 500) || "",
  }))
  out.rows = rows.slice(0, 4)
  const refCtl = document.querySelector(".approval-sheet .as-fill-ref")
  out.refCtlHtml = refCtl ? refCtl.outerHTML.slice(0, 800) : null
  out.refCodeCount = document.querySelectorAll(".approval-sheet .as-ref-code").length
  // Vue 组件树里找 DocSheet 的 props.head
  try {
    const app = document.querySelector("#app")?.__vue_app__
    const root = app?._instance
    const found = []
    const seen = new Set()
    const walk = (vnode) => {
      if (!vnode || seen.has(vnode)) return
      seen.add(vnode)
      const inst = vnode.component
      if (inst) {
        found.push(inst)
        walk(inst.subTree)
      }
      if (Array.isArray(vnode.children)) for (const c of vnode.children) walk(c)
    }
    walk(root?.subTree)
    const sheets = found.filter((i) => i.props && i.props.panelCode)
    out.sheetCount = sheets.length
    out.sheets = sheets.map((i) => ({
      panelCode: i.props.panelCode,
      headCustomer: i.props.head?.["客户名"],
      headCode: i.props.head?.["客户编号"],
      headDocNo: i.props.head?.["文档编号"],
      headKeys: Object.keys(i.props.head || {}).length,
    }))
    out.hasVueApp = !!app
  } catch (e) {
    out.vueErr = String(e)
  }
  return out
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/_scratch/ego-approval-custcode-20261120/round-02-prod-doc.png" })
console.log("space:", task.spaceId)
