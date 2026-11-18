const task = await taskSpace(51);
const page = task.page("p1");
await page.goto("http://127.0.0.1:8090/#/panelx/form/QC_INSP?code=IJ-2026-11-0021", { timeout: 60000 });
await page.waitForTimeout(4000);
const before = await page.evaluate(() => ({
  status: (document.querySelector(".px-form-title__tag, .el-tag")?.textContent || "").trim(),
  buttons: [...document.querySelectorAll("button")].map((b) => (b.innerText || "").replace(/\s+/g, "")).filter(Boolean).slice(0, 20),
}));
console.log("BEFORE", JSON.stringify(before));

await page.click('loc=role:button[name="审核"]', { label: "点击审核按钮" });
await page.waitForTimeout(2500);
const after = await page.evaluate(() => ({
  box: (document.querySelector(".el-message-box")?.innerText || "").replace(/\s+/g, " ").trim(),
  msg: [...document.querySelectorAll(".el-message")].map((n) => n.innerText.trim()),
}));
console.log("AFTER", JSON.stringify(after));
const shot = await page.screenshot({ path: "C:/Users/Lenovo/ego/autodraft-notice-20261117/r05-after-audit-click.png" });
console.log({ shot });
