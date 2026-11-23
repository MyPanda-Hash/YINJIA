// round-09: 确定导入 → 客户名/立项编号 DOM → 截图（不保存）
const task = await taskSpace(31)
const page = task.page("p1")
await page.click("loc=css:.el-dialog__footer button.el-button--primary")
await page.waitForTimeout(1800)
const info = await page.evaluate(() => {
  const out = {
    dialogOpen: [...document.querySelectorAll(".el-dialog")].some((d) => d.offsetParent !== null && d.textContent.includes("客户 · 参照选择")),
    refCodeCount: document.querySelectorAll(".approval-sheet .as-ref-code").length,
  }
  const row = [...document.querySelectorAll(".approval-sheet .as-row")]
    .find((r) => (r.querySelector(".as-name")?.textContent || "").trim() === "客户名")
  out.customerRowText = row?.querySelector(".as-ref-text")?.textContent ?? null
  out.customerRowHtml = row?.querySelector(".as-fill-main")?.innerHTML?.slice(0, 900) ?? null
  out.infoRows = [...document.querySelectorAll(".approval-sheet .as-info-row")].map((r) => r.textContent.replace(/\s+/g, " ").trim())
  return out
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/_scratch/ego-approval-custcode-20261120/round-09-prod-selected.png" })
console.log("space:", task.spaceId)
