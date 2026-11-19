// round-25: 构建产物在 1440 / 768 / 375 下的横向溢出检查（客户名格 + 文档）
const task = await taskSpace(31)
const page = task.page("p1")
const results = []
for (const width of [1440, 768, 375]) {
  await page.cdp("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false })
  await page.waitForTimeout(600)
  const r = await page.evaluate(() => {
    const row = [...document.querySelectorAll(".approval-sheet .as-row")]
      .find((x) => (x.querySelector(".as-name")?.textContent || "").trim() === "客户名")
    const ctl = row?.querySelector(".as-fill-ref, .as-ro-ref")
    const txt = row?.querySelector(".as-ref-text, .as-ro-text")
    const br = (el) => el ? el.getBoundingClientRect() : null
    const b = br(ctl)
    return {
      viewport: innerWidth,
      docScrollW: document.documentElement.scrollWidth,
      docClientW: document.documentElement.clientWidth,
      bodyScrollW: document.body.scrollWidth,
      bodyClientW: document.body.clientWidth,
      sheetW: Math.round(br(document.querySelector(".approval-sheet"))?.width || 0),
      rowW: Math.round(br(row)?.width || 0),
      ctlW: b ? Math.round(b.width) : null,
      ctlRight: b ? Math.round(b.right) : null,
      sheetRight: Math.round(br(document.querySelector(".approval-sheet"))?.right || 0),
      textTruncated: txt ? txt.scrollWidth > txt.clientWidth + 1 : null,
      cellText: row?.querySelector(".as-fill-main")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    }
  })
  results.push({ width, ...r })
  console.log(JSON.stringify(results[results.length - 1]))
  await page.screenshot({ path: `/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/_scratch/ego-approval-custcode-20261120/round-25-${width}.png` })
}
await page.cdp("Emulation.clearDeviceMetricsOverride")
console.log("space:", task.spaceId)
