const fs = await import("node:fs/promises");
const OUT = "C:/Users/vigna/ego/qc-print-audit-20261116/";
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === "qc-print-audit-20261116");
const task = entry ? await taskSpace(entry.id) : await taskSpace("qc-print-audit-20261116");
const page = (await task.pages())[0];
async function exportPdf(code, firstDoc) {
  await page.goto("http://127.0.0.1:8090/#/panelx/list/" + code, { timeout: 90000 });
  await page.waitForTimeout(6500);
  if (firstDoc) { await page.evaluate(() => { const tr = document.querySelector(".doc-select-rail tbody tr"); if (tr) tr.click(); }); await page.waitForTimeout(2500); }
  await page.evaluate(() => {
    window.__pdfBlob = null;
    const origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { if (blob && String(blob.type).includes("pdf")) window.__pdfBlob = blob; return origCreate(blob); };
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.href && this.href.startsWith("blob:")) return; return origClick.call(this); };
  });
  await page.evaluate(() => { const b = [...document.querySelectorAll(".as-side-btn")].find((x) => (x.textContent || "").trim() === "导出"); if (b) b.click(); });
  await page.waitForTimeout(1200);
  const clicked = await page.evaluate(() => {
    const d = [...document.querySelectorAll(".el-dialog")].find((x) => x.offsetWidth);
    if (!d) return false;
    const hit = [...d.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "导出 PDF" && !e.children.length);
    if (!hit) return false;
    hit.click(); return true;
  });
  await page.waitForTimeout(10000);
  const b64 = await page.evaluate(async () => {
    const blob = window.__pdfBlob;
    if (!blob) return "";
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.readAsDataURL(blob); });
  });
  if (b64) { await fs.writeFile(OUT + code + "-export.pdf", Buffer.from(b64, "base64")); console.log(code + " pdf saved size=" + (await fs.stat(OUT + code + "-export.pdf")).size); }
  else console.log(code + " NO PDF clicked=" + clicked);
}
await exportPdf("QC_FIRST_INSP", true);
await exportPdf("QC_LINE_PATROL", true);
await exportPdf("QC_PROC_INSP", true);
console.log("DONE5");
