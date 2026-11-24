// round-18: 修复后新建单 → 实际选客户（惠州市芯悦 KH00021）→ 前缀即时出现
const task = await taskSpace(31)
const page = task.page("p1")
await page.evaluate(() => {
  const btn = [...document.querySelectorAll(".as-side-btn")].find((b) => b.textContent.trim() === "新增")
  if (btn) btn.click()
})
await page.waitForTimeout(1800)
await page.click(".approval-sheet .as-fill-ref")
await page.waitForTimeout(1200)
const picked = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll(".el-dialog")].find((d) => d.offsetParent !== null && d.textContent.includes("客户 · 参照选择"))
  if (!dlg) return { err: "no dialog" }
  const row = [...dlg.querySelectorAll("tbody tr")].find((tr) => tr.textContent.includes("芯悦"))
  if (!row) return { err: "no row" }
  row.querySelectorAll("td")[1].click()
  return { ok: true, row: row.textContent.replace(/\s+/g, " ").trim().slice(0, 60) }
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
  return {
    refCodeCount: document.querySelectorAll(".approval-sheet .as-ref-code").length,
    codeText: code?.textContent?.trim() ?? null,
    nameText: row?.querySelector(".as-ref-text")?.textContent?.trim() ?? null,
    cellText: row?.querySelector(".as-fill-main")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    docnoInput: [...document.querySelectorAll(".approval-sheet .as-info-row")]
      .find((r) => (r.querySelector(".as-info-label")?.textContent || "").trim() === "立项编号")
      ?.querySelector("input")?.value ?? null,
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/_scratch/ego-approval-custcode-20261120/round-18-local-fixed-selected.png" })
console.log("space:", task.spaceId)
