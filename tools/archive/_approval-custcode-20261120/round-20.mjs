// round-20: 只读态（已归档）验证「编码 客户名」前缀
const task = await taskSpace(31)
const page = task.page("p1")
await page.goto("http://127.0.0.1:5173/#/panelx/list/RD_APPROVAL?docNo=LXA-2026-11-0031", { timeout: 30000 })
await page.waitForTimeout(3500)
const info = await page.evaluate(() => {
  const row = [...document.querySelectorAll(".approval-sheet .as-row")]
    .find((r) => (r.querySelector(".as-name")?.textContent || "").trim() === "客户名")
  const ro = row?.querySelector(".as-ro-ref")
  const code = row?.querySelector(".as-ref-code.is-prefix")
  const txt = ro?.querySelector(".as-ro-text")
  const r = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null
  return {
    rows: [...document.querySelectorAll(".approval-sheet .as-row")].slice(0, 2).map((x) => x.textContent.replace(/\s+/g, " ").trim().slice(0, 60)),
    hasRoRef: !!ro,
    refCodeCount: document.querySelectorAll(".approval-sheet .as-ref-code").length,
    codeText: code?.textContent?.trim() ?? null,
    nameText: txt?.textContent?.trim() ?? null,
    cellText: row?.querySelector(".as-fill-main")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    rowRect: r(row), roRect: r(ro),
    truncated: txt ? txt.scrollWidth > txt.clientWidth + 1 : null,
    docScroll: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth },
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/_scratch/ego-approval-custcode-20261120/round-20-local-readonly.png" })
console.log("space:", task.spaceId)
