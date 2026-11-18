const task = await taskSpace(51);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/list/QC_INSP?docNo=IJ-2026-11-0019", { timeout: 60000 });
await page.waitForTimeout(3000);
const info = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")]
    .map((b) => (b.innerText || "").trim())
    .filter((t) => t && t.length <= 12);
  const dlg = [...document.querySelectorAll(".el-dialog__title, .el-drawer__title")]
    .map((n) => n.textContent.trim());
  return { url: location.hash, buttons: [...new Set(btns)], dialogs: dlg };
});
console.log(JSON.stringify(info, null, 1));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r03-qcinsp.png" });
console.log({ shot });
