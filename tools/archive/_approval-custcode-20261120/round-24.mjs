// round-24: 4174 构建产物上实际选客户，验证前缀
const task = await taskSpace(31)
const page = task.page("p1")
await page.goto("http://127.0.0.1:4174/#/panelx/list/RD_APPROVAL?docNo=LXA-2026-11-0031", { timeout: 30000 })
await page.waitForTimeout(3500)
const initial = await page.evaluate(() => ({
  url: location.href,
  hasSheet: !!document.querySelector(".approval-sheet"),
  refCodeCount: document.querySelectorAll(".approval-sheet .as-ref-code").length,
}))
console.log("initial:", JSON.stringify(initial))
if (initial.hasSheet) {
  await page.click(".approval-sheet .as-fill-ref")
  await page.waitForTimeout(1200)
  const picked = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll(".el-dialog")].find((d) => d.offsetParent !== null && d.textContent.includes("客户 · 参照选择"))
    if (!dlg) return { err: "no dialog" }
    const row = [...dlg.querySelectorAll("tbody tr")].find((tr) => tr.textContent.includes("鑫万"))
    if (!row) return { err: "no row" }
    row.querySelectorAll("td")[1].click()
    return { ok: true, row: row.textContent.replace(/\s+/g, " ").trim().slice(0, 50) }
  })
  console.log("pick:", JSON.stringify(picked))
  await page.waitForTimeout(900)
  const st = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll(".el-dialog")].find((d) => d.offsetParent !== null && d.textContent.includes("客户 · 参照选择"))
    const btn = dlg && [...dlg.querySelectorAll(".el-dialog__footer button")].find((b) => /确定/.test(b.textContent))
    return { btn: btn?.textContent?.trim(), disabled: btn?.disabled }
  })
  console.log("state:", JSON.stringify(st))
  if (st.btn && /1 行/.test(st.btn)) {
    await page.click("loc=css:.el-dialog__footer button.el-button--primary")
    await page.waitForTimeout(1800)
  }
  const info = await page.evaluate(() => {
    const row = [...document.querySelectorAll(".approval-sheet .as-row")]
      .find((r) => (r.querySelector(".as-name")?.textContent || "").trim() === "客户名")
    const code = row?.querySelector(".as-ref-code.is-prefix")
    const txt = row?.querySelector(".as-ref-text")
    return {
      refCodeCount: document.querySelectorAll(".approval-sheet .as-ref-code").length,
      codeText: code?.textContent?.trim() ?? null,
      nameText: txt?.textContent?.trim() ?? null,
      cellText: row?.querySelector(".as-fill-main")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      truncated: txt ? txt.scrollWidth > txt.clientWidth + 1 : null,
      docnoInput: [...document.querySelectorAll(".approval-sheet .as-info-row")]
        .find((r) => (r.querySelector(".as-info-label")?.textContent || "").trim() === "立项编号")
        ?.querySelector("input")?.value ?? null,
      docScroll: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth },
    }
  })
  console.log(JSON.stringify(info, null, 2))
  await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/_scratch/ego-approval-custcode-20261120/round-24-build-preview-selected.png" })
}
console.log("space:", task.spaceId)
