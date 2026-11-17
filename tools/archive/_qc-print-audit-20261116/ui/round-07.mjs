const fs = await import("node:fs/promises");
const OUT = "C:/Users/vigna/ego/qc-print-audit-20261116/";
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === "qc-print-audit-20261116");
const task = entry ? await taskSpace(entry.id) : await taskSpace("qc-print-audit-20261116");
const page = (await task.pages())[0];
async function exportPdf(code) {
  await page.goto("http://127.0.0.1:8090/#/panelx/list/" + code, { timeout: 90000 });
  await page.waitForTimeout(7000);
  await page.evaluate(() => { const tr = document.querySelector(".doc-select-rail tbody tr"); if (tr) tr.click(); });
  await page.waitForTimeout(3000);
  const before = await page.evaluate(() => ({ side: [...document.querySelectorAll(".as-side-btn")].map((b) => (b.textContent || "").trim()).filter(Boolean), dialogs: document.querySelectorAll(".el-dialog").length }));
  console.log(code + " before=" + JSON.stringify(before));
  await page.evaluate(() => { window.__pdfBlob = null; const oc = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { if (b && String(b.type).includes("pdf")) window.__pdfBlob = b; return oc(b); }; const ocl = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.href && this.href.startsWith("blob:")) return; return ocl.call(this); }; });
  const opened = await page.evaluate(() => { const b = [...document.querySelectorAll(".as-side-btn")].find((x) => (x.textContent || "").trim() === "导出"); if (!b) return false; b.click(); return true; });
  await page.waitForTimeout(1500);
  const dlg = await page.evaluate(() => {
    const ds = [...document.querySelectorAll(".el-dialog")].filter((d) => d.offsetWidth);
    return ds.map((d) => ({ title: (d.querySelector(".el-dialog__title")?.textContent || "").trim(), items: [...d.querySelectorAll(".efmt-name")].map((e) => (e.textContent || "").trim()) }));
  });
  console.log(code + " opened=" + opened + " dlg=" + JSON.stringify(dlg));
  const clicked = await page.evaluate(() => {
    const d = [...document.querySelectorAll(".el-dialog")].find((x) => x.offsetWidth);
    if (!d) return false;
    const hit = [...d.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "导出 PDF" && !e.children.length);
    if (!hit) return false;
    hit.click(); return true;
  });
  await page.waitForTimeout(12000);
  const b64 = await page.evaluate(async () => { const blob = window.__pdfBlob; if (!blob) return ""; return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.readAsDataURL(blob); }); });
  if (b64) { await fs.writeFile(OUT + code + "-export.pdf", Buffer.from(b64, "base64")); console.log(code + " pdf saved"); }
  else console.log(code + " no blob clicked=" + clicked);
}
await exportPdf("QC_LINE_PATROL");
await exportPdf("QC_PROC_INSP");
console.log("DONE6");
