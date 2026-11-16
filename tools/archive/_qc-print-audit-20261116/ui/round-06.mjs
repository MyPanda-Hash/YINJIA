const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === "qc-print-audit-20261116");
const task = entry ? await taskSpace(entry.id) : await taskSpace("qc-print-audit-20261116");
const page = (await task.pages())[0];
await page.goto("http://127.0.0.1:8090/#/panelx/list/QC_FIRST_INSP", { timeout: 90000 });
await page.waitForTimeout(6500);
await page.evaluate(() => { const tr = document.querySelector(".doc-select-rail tbody tr"); if (tr) tr.click(); });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  setTimeout(() => {
    const b = [...document.querySelectorAll(".as-side-btn")].find((x) => (x.textContent || "").trim() === "打印");
    if (b) b.click();
  }, 500);
});
console.log("print scheduled");
