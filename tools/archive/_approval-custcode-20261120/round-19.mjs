// round-19: 修复后（含参照框撑满）载入已保存单，量宽度并截图
const task = await taskSpace(31)
const page = task.page("p1")
await page.goto("http://127.0.0.1:5173/#/panelx/list/RD_APPROVAL?docNo=LXA-2026-11-0031", { timeout: 30000 })
await page.waitForTimeout(3500)
const info = await page.evaluate(() => {
  const row = [...document.querySelectorAll(".approval-sheet .as-row")]
    .find((r) => (r.querySelector(".as-name")?.textContent || "").trim() === "客户名")
  const box = row?.querySelector(".as-fill-main")
  const ctl = row?.querySelector(".as-fill-ref")
  const txt = row?.querySelector(".as-ref-text")
  const code = row?.querySelector(".as-ref-code.is-prefix")
  const r = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null
  return {
    refCodeCount: document.querySelectorAll(".approval-sheet .as-ref-code").length,
    codeText: code?.textContent?.trim() ?? null,
    nameText: txt?.textContent?.trim() ?? null,
    cellText: box?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    rowRect: r(row), fillMain: r(box), ctl: r(ctl),
    textClientWidth: txt?.clientWidth ?? null,
    textScrollWidth: txt?.scrollWidth ?? null,
    truncated: txt ? txt.scrollWidth > txt.clientWidth + 1 : null,
    viewport: { w: innerWidth, h: innerHeight },
    docScroll: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth },
  }
})
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/_scratch/ego-approval-custcode-20261120/round-19-local-fixed-fullwidth.png" })
await page.screenshot({ path: "/Users/panda/Projects/_yinjia-w-sql/repos/YINJIA/_scratch/ego-approval-custcode-20261120/round-19-local-fixed-fullwidth-full.png", fullPage: true })
console.log("space:", task.spaceId)
