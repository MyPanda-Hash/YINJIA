const spaces = await listTaskSpaces();
const entry = spaces.find((s) => s.name === "qc-print-audit-20261116");
const task = entry ? await taskSpace(entry.id) : await taskSpace("qc-print-audit-20261116");
const page = (await task.pages())[0];
async function measure(code, sel) {
  await page.goto("http://127.0.0.1:8090/#/panelx/list/" + code, { timeout: 90000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate((s) => {
    const pick = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), cls: String(e.className).slice(0, 30) }; };
    return { code: s, vw: innerWidth, vh: innerHeight, rail: pick(".doc-select-rail"), scroll: pick(".approval-layout > .sheet-scroll"), sheet: pick(s), side: pick(".approval-side"), layout: pick(".approval-layout") };
  }, sel);
  console.log(JSON.stringify(r));
}
await measure("QC_FIRST_INSP", ".fi-sheet");
await measure("QC_PROC_INSP", ".qr-sheet");
await measure("QC_LINE_PATROL", ".lp-sheet");
await measure("QC_OQC_REPORT", ".oqc-sheet");
console.log("DONE3");
