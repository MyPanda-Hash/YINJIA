// round-10: 读「立项编号」输入框的真实 value（el-input 值不进 innerText），并尝试拦保存请求验证 head 客户编号
const task = await taskSpace(31)
const page = task.page("p1")
const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".approval-sheet .as-info-row")].map((r) => ({
    label: r.querySelector(".as-info-label")?.textContent?.trim(),
    text: r.querySelector(".as-info-value")?.textContent?.replace(/\s+/g, " ").trim(),
    input: r.querySelector("input")?.value ?? null,
  }))
  const cRow = [...document.querySelectorAll(".approval-sheet .as-row")]
    .find((r) => (r.querySelector(".as-name")?.textContent || "").trim() === "客户名")
  return {
    infoRows: rows,
    customer: cRow?.querySelector(".as-ref-text")?.textContent?.trim(),
    refCodeCount: document.querySelectorAll(".approval-sheet .as-ref-code").length,
  }
})
console.log(JSON.stringify(info, null, 2))
console.log("space:", task.spaceId)
