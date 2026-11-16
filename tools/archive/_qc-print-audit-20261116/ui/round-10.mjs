const fs = await import("node:fs/promises");
const OUT = "C:/Users/vigna/ego/qc-print-audit-20261116/";
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === "qc-print-audit-20261116");
const task = entry ? await taskSpace(entry.id) : await taskSpace("qc-print-audit-20261116");
const page = (await task.pages())[0];
await page.goto("http://127.0.0.1:8090/?cb=" + Date.now() + "#/panelx/list/QC_LINE_PATROL", { timeout: 90000 });
await page.waitForTimeout(8000);
await page.evaluate(() => { const tr = document.querySelector(".doc-select-rail tbody tr"); if (tr) tr.click(); });
await page.waitForTimeout(3000);
await page.evaluate(() => { window.__printCalled = 0; window.print = () => { window.__printCalled++; }; });
await page.evaluate(() => { const b = [...document.querySelectorAll(".as-side-btn")].find((x) => (x.textContent || "").trim() === "导出"); if (b) b.click(); });
await page.waitForTimeout(2500);
const dlg = await page.evaluate(() => {
  const ds = [...document.querySelectorAll(".el-dialog")].filter((d) => d.offsetWidth);
  return ds.map((d) => ({ title: (d.querySelector(".el-dialog__title")?.textContent || "").trim(), names: [...d.querySelectorAll(".efmt-name")].map((e) => (e.textContent || "").trim()) }));
});
console.log("DLG=" + JSON.stringify(dlg));
const clicked = await page.evaluate(() => {
  const ds = [...document.querySelectorAll(".el-dialog")].filter((d) => d.offsetWidth);
  for (const d of ds) {
    const hit = [...d.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "打印预览" && !e.children.length);
    if (hit) { hit.click(); return true; }
  }
  return false;
});
console.log("clicked=" + clicked);
await page.waitForTimeout(4500);
const st = await page.evaluate(() => {
  const s = document.getElementById("qc-wide-print-page");
  return { printCalled: window.__printCalled, host: !!document.getElementById("yj-print-host"), bodyClass: document.body.classList.contains("approval-printing"), pageStyle: s ? s.textContent : "MISSING" };
});
console.log("result=" + JSON.stringify(st));
try {
  const pdf = await page.cdp("Page.printToPDF", { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.315, marginBottom: 0.315, marginLeft: 0.315, marginRight: 0.315 });
  await fs.writeFile(OUT + "QC_LINE_PATROL-native4.pdf", Buffer.from(pdf.data, "base64"));
  console.log("native4 saved");
} catch (e) {}
await page.evaluate(() => {
  document.body.classList.remove("approval-printing");
  document.documentElement.style.removeProperty("--print-zoom");
  document.getElementById("qc-wide-print-page")?.remove();
  document.getElementById("yj-print-host")?.remove();
  document.getElementById("yj-print-host-css")?.remove();
});
console.log("DONE9");
