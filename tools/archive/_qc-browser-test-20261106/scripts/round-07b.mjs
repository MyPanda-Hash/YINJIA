// ego round-07b: 新增一张草稿(精确匹配侧栏「新增」),采集纸张与侧栏事实
const task = await taskSpace(9);
const page = task.page("p1");
await page.click('text="新增"', { label: "新增制程检验单草稿" });
await page.waitForTimeout(3000);
const facts = await page.evaluate(() => {
  const q = (s) => [...document.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const headInputs = q(".qr-head-table input").map((x) => x.value);
  const planInput = [...document.querySelectorAll(".qr-head-table input")].find((x) => x.value && x.value.includes("出货控制计划执行"));
  const no = q(".qr-head-table tr")[0]?.querySelector("td")?.textContent?.trim() || "";
  const side = q(".as-side-btn").map((b) => ({ text: txt(b), disabled: b.className.includes("disabled") }));
  const status = q(".doc-status").map((x) => txt(x));
  return {
    docNo: no, status,
    headInputs,
    planIsInput: !!planInput, planValue: planInput?.value || "",
    hasGongxu: q(".qr-head-table th").some((th) => txt(th) === "工序"),
    side,
  };
});
console.log(JSON.stringify(facts, null, 1));
const path = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/round07-new-draft.png" });
console.log("shot=" + path);
