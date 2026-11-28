// round-05: 诊断 —— 列出所有宽表格行与坐标,确认锚点行
const task = await taskSpace(17);
const page = task.page("p1");
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1680, height: 1500, deviceScaleFactor: 1, mobile: false });
await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER?docNo=YJ-20260915-06", { timeout: 45000 });
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const out = [];
  document.querySelectorAll("table").forEach((tb, ti) => {
    const trs = [...tb.querySelectorAll("tr")];
    trs.forEach((tr, ri) => {
      const r = R(tr);
      const t = norm(tr.innerText);
      if (r.w > 300 && t) out.push({ table: ti, row: ri, rect: r, has: t.includes("YJ-AJ-017"), text: t.slice(0, 90) });
    });
  });
  return { tables: document.querySelectorAll("table").length, rows: out };
});
console.log(JSON.stringify(info, null, 2));
