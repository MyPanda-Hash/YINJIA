// ego round-16: 打开「审批情况」,采集审批留痕
const task = await taskSpace(9);
const page = task.page("p1");
await page.click('text="审批情况"', { label: "打开审批情况" });
await page.waitForTimeout(1500);
const rows = await page.evaluate(() => {
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const dialogs = [...document.querySelectorAll(".el-dialog")].filter((d) => d.getBoundingClientRect().height > 0);
  const d = dialogs[dialogs.length - 1];
  if (!d) return { dialog: null };
  return {
    title: txt(d.querySelector(".el-dialog__title")),
    body: txt(d.querySelector(".el-dialog__body")).slice(0, 1200),
  };
});
console.log(JSON.stringify(rows, null, 1));
const path = await page.screenshot({ path: "D:/workspace/yinjia/tools/archive/_qc-browser-test-20261106/round16-approval-history.png" });
console.log("shot=" + path);
