const fs = await import("node:fs/promises");
const OUT = "C:/Users/vigna/ego/qc-print-audit-20261116/";
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === "qc-print-audit-20261116");
const task = entry ? await taskSpace(entry.id) : await taskSpace("qc-print-audit-20261116");
const page = (await task.pages())[0];
const panels = [
  { code: "QC_PROC_INSP", sel: ".qr-sheet", pageId: "qr-print-page" },
  { code: "QC_FIRST_INSP", sel: ".fi-sheet", pageId: "qc-wide-print-page" },
  { code: "QC_LINE_PATROL", sel: ".lp-sheet", pageId: "qc-wide-print-page" }
];
for (const p of panels) {
  await page.goto("http://127.0.0.1:8090/#/panelx/list/" + p.code, { timeout: 90000 });
  await page.waitForTimeout(7000);
  await page.evaluate(() => { const tr = document.querySelector(".doc-select-rail tbody tr"); if (tr) tr.click(); });
  await page.waitForTimeout(2800);
  // 打印预览(应走原生打印)
  await page.evaluate(() => { window.__printCalled = 0; window.print = () => { window.__printCalled++; }; });
  await page.evaluate(() => { const b = [...document.querySelectorAll(".as-side-btn")].find((x) => (x.textContent || "").trim() === "导出"); if (b) b.click(); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const d = [...document.querySelectorAll(".el-dialog")].find((x) => x.offsetWidth);
    const hit = d ? [...d.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "打印预览" && !e.children.length) : null;
    if (hit) hit.click();
  });
  await page.waitForTimeout(3500);
  const st = await page.evaluate((pid) => {
    const st = document.getElementById(pid);
    return {
      printCalled: window.__printCalled,
      host: !!document.getElementById("yj-print-host"),
      bodyClass: document.body.classList.contains("approval-printing"),
      pageStyle: st ? st.textContent : "MISSING",
      zoom: document.documentElement.style.getPropertyValue("--print-zoom")
    };
  }, p.pageId);
  console.log(p.code + " preview=" + JSON.stringify(st));
  try {
    const pdf = await page.cdp("Page.printToPDF", { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.315, marginBottom: 0.315, marginLeft: 0.315, marginRight: 0.315 });
    await fs.writeFile(OUT + p.code + "-native2.pdf", Buffer.from(pdf.data, "base64"));
    console.log(p.code + " native2 pdf saved");
  } catch (e) { console.log(p.code + " native pdf fail " + String(e).slice(0, 80)); }
  await page.evaluate(() => {
    document.body.classList.remove("approval-printing");
    document.documentElement.style.removeProperty("--print-zoom");
    ["qr-print-page", "qc-wide-print-page", "ic-print-page", "sg-print-page"].forEach((id) => document.getElementById(id)?.remove());
  });
  // 导出 PDF
  await page.evaluate(() => {
    window.__pdfBlob = null;
    const oc = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { if (b && String(b.type).includes("pdf")) window.__pdfBlob = b; return oc(b); };
    const ocl = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.href && this.href.startsWith("blob:")) return; return ocl.call(this); };
  });
  await page.evaluate(() => { const b = [...document.querySelectorAll(".as-side-btn")].find((x) => (x.textContent || "").trim() === "导出"); if (b) b.click(); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const d = [...document.querySelectorAll(".el-dialog")].find((x) => x.offsetWidth);
    const hit = d ? [...d.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "导出 PDF" && !e.children.length) : null;
    if (hit) hit.click();
  });
  await page.waitForTimeout(12000);
  const b64 = await page.evaluate(async () => { const blob = window.__pdfBlob; if (!blob) return ""; return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.readAsDataURL(blob); }); });
  if (b64) { await fs.writeFile(OUT + p.code + "-export2.pdf", Buffer.from(b64, "base64")); console.log(p.code + " export2 pdf saved"); }
  else console.log(p.code + " export2 NO BLOB");
}
console.log("DONE7");
