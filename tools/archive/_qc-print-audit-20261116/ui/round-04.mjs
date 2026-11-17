const fs = await import("node:fs/promises");
const OUT = "C:/Users/vigna/ego/qc-print-audit-20261116/";
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === "qc-print-audit-20261116");
const task = entry ? await taskSpace(entry.id) : await taskSpace("qc-print-audit-20261116");
const page = (await task.pages())[0];
await page.goto("http://127.0.0.1:8090/#/panelx/list/QC_OQC_REPORT", { timeout: 90000 });
await page.waitForTimeout(7000);
const st = await page.evaluate(() => ({ sheet: !!document.querySelector(".oqc-sheet"), railRows: document.querySelectorAll(".doc-select-rail tbody tr").length }));
console.log("OQC: " + JSON.stringify(st));
await page.evaluate(() => { document.body.classList.add("approval-printing"); });
await page.waitForTimeout(900);
try {
  const pdf = await page.cdp("Page.printToPDF", { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.315, marginBottom: 0.315, marginLeft: 0.315, marginRight: 0.315 });
  await fs.writeFile(OUT + "QC_OQC_REPORT-native.pdf", Buffer.from(pdf.data, "base64"));
  console.log("OQC PDF saved");
} catch (e) { console.log("OQC pdf fail " + String(e).slice(0, 80)); }
await page.evaluate(() => { document.body.classList.remove("approval-printing"); });
console.log("DONE4");
