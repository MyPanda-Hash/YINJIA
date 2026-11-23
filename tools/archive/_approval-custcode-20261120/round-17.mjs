// round-17: 修复后本地打开已保存的立项单，验证「编码 客户名」前缀（head 从库里读回）
const task = await taskSpace(31)
const page = task.page("p1")
await page.goto("http://127.0.0.1:5173/#/panelx/list/RD_APPROVAL?docNo=LXA-2026-11-0031", { timeout: 30000 })
await page.waitForTimeout(3500)
const info = await page.evaluate(() => {
  const row = [...document.querySelectorAll(".approval-sheet .as-row")]
    .find((r) => (r.querySelector(".as-name")?.textContent || "").trim() === "客户名")
  const code = row?.querySelector(".as-ref-code.is-prefix")
  const fill = row?.querySelector(".as-fill-main")
  return {
    url: location.href,
    hasSheet: !!document.querySelector(".approval-sheet"),
    refCodeCount: document.querySelectorAll(".approval-sheet .as-ref-code").length,
    codeText: code?.textContent?.trim() ?? null,
    codeColor: code ? getComputedStyle(code).color : null,
    nameText: row?.querySelector(".as-ref-text")?.textContent?.trim() ?? null,
    cellText: fill?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    customerHtml: fill?.innerHTML?.slice(0, 700) ?? null,
    docnoInput: [...document.querySelectorAll(".approval-sheet .as-info-row")]
      .find((r) => (r.querySelector(".as-info-label")?.textContent || "").trim() === "立项编号")
      ?.querySelector("input")?.value ?? null,
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/_scratch/ego-approval-custcode-20261120/round-17-local-fixed-loaded.png" })
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/_scratch/ego-approval-custcode-20261120/round-17-local-fixed-loaded-full.png", fullPage: true })
console.log("space:", task.spaceId)
