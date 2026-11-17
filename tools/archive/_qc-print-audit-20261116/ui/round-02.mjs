const fs = await import("node:fs/promises");
const OUT = "C:/Users/vigna/ego/qc-print-audit-20261116/";
const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === "qc-print-audit-20261116");
const task = entry ? await taskSpace(entry.id) : await taskSpace("qc-print-audit-20261116");
const page = (await task.pages())[0];
async function toPanel(code) {
  await page.goto("http://127.0.0.1:8090/#/panelx/list/" + code, { timeout: 90000 });
  await page.waitForTimeout(6500);
}
async function previewShot(code) {
  await page.evaluate(() => { window.__printCalled = 0; window.print = () => { window.__printCalled++; }; });
  await page.evaluate(() => { const b = [...document.querySelectorAll(".as-side-btn")].find((x) => (x.textContent || "").trim() === "导出"); if (b) b.click(); });
  await page.waitForTimeout(1200);
  const clicked = await page.evaluate(() => {
    const d = [...document.querySelectorAll(".el-dialog")].find((x) => x.offsetWidth);
    if (!d) return false;
    const hit = [...d.querySelectorAll("*")].find((e) => (e.textContent || "").trim() === "打印预览" && !e.children.length);
    if (!hit) return false;
    hit.click(); return true;
  });
  await page.waitForTimeout(7000);
  const host = await page.evaluate(() => {
    const h = document.getElementById("yj-print-host");
    const img = h ? h.querySelector("img") : null;
    return { host: !!h, printCalled: window.__printCalled, src: img ? img.src : "", w: img ? img.naturalWidth : 0, hgt: img ? img.naturalHeight : 0 };
  });
  if (host.src) {
    const small = await page.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode();
      const w = 1000, h = Math.round((img.naturalHeight * w) / img.naturalWidth);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      return c.toDataURL("image/jpeg", 0.88);
    }, host.src);
    await fs.writeFile(OUT + code + "-printpreview2.jpg", Buffer.from(small.split(",")[1], "base64"));
  }
  await page.evaluate(() => { document.getElementById("yj-print-host")?.remove(); document.getElementById("yj-print-host-css")?.remove(); });
  return { code, clicked, host: { host: host.host, printCalled: host.printCalled, w: host.w, hgt: host.hgt } };
}
await toPanel("QC_PROC_INSP");
await page.waitForTimeout(1000);
const rows = await page.evaluate(() => [...document.querySelectorAll(".doc-select-rail tbody tr")].map((r) => (r.innerText || "").replace(/\s+/g, " ").trim().slice(0, 80)));
console.log("QR rail: " + JSON.stringify(rows));
let picked = -1;
for (let i = 0; i < rows.length; i++) {
  await page.evaluate((idx) => { const tr = [...document.querySelectorAll(".doc-select-rail tbody tr")][idx]; if (tr) tr.click(); }, i);
  await page.waitForTimeout(2200);
  const st = await page.evaluate(() => ({
    docNo: (document.querySelector(".qr-sheet .qr-docno, .qr-sheet input")?.value || "").slice(0, 30),
    gridRows: document.querySelectorAll(".qr-grid tbody tr").length,
    sheetW: Math.round((document.querySelector(".qr-sheet")?.getBoundingClientRect().width) || 0),
    sheetH: Math.round((document.querySelector(".qr-sheet")?.getBoundingClientRect().height) || 0),
    emptyPlaceholder: (document.querySelector(".qr-sheet")?.innerText || "").includes("暂无检验项")
  }));
  console.log("QR row " + i + ": " + JSON.stringify(st));
  if (st.gridRows > 0 || st.sheetH > 500) { picked = i; break; }
}
if (picked >= 0) console.log("QR picked row=" + picked + " preview=" + JSON.stringify(await previewShot("QC_PROC_INSP-DATA")));
await toPanel("QC_OQC_REPORT");
await page.waitForTimeout(1500);
const oqc = await page.evaluate(() => ({ docNo: (document.querySelector(".ic-meta-no")?.innerText || document.querySelector(".oqc-sheet")?.innerText || "").replace(/\s+/g, " ").slice(0, 80), railRows: document.querySelectorAll(".doc-select-rail tbody tr").length, sheet: !!document.querySelector(".oqc-sheet") }));
console.log("OQC state: " + JSON.stringify(oqc));
if (oqc.sheet && oqc.railRows > 0) { await page.evaluate(() => { const tr = document.querySelector(".doc-select-rail tbody tr"); if (tr) tr.click(); }); await page.waitForTimeout(2500); }
const oqcPreview = await previewShot("QC_OQC_REPORT");
const afterOqc = await page.evaluate(() => ({ tabs: document.querySelectorAll(".el-dialog").length, bodyClass: document.body.classList.contains("approval-printing") }));
console.log("OQC preview: " + JSON.stringify(oqcPreview) + " after=" + JSON.stringify(afterOqc));
console.log("DONE2");
