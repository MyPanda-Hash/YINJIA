// round-03: 采购订单 YJ-20260915-06 量取(表头/明细行/行内是否有 已入库·未入库 两列)
const task = await taskSpace(17);
const page = task.page("p1");
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1680, height: 1500, deviceScaleFactor: 1, mobile: false });
await page.goto("http://localhost:5173/#/panelx/list/PU_ORDER?docNo=YJ-20260915-06", { timeout: 40000 });
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const rows = [...document.querySelectorAll("table tr")].filter((tr) => norm(tr.innerText).includes("YJ-AJ-017"));
  const listRows = [...document.querySelectorAll("table tr")].filter((tr) => norm(tr.innerText).includes("YJ-20260915-06"));
  return {
    viewport: { w: innerWidth, h: innerHeight },
    docHeight: document.documentElement.scrollHeight,
    rows: rows.map((el) => ({ rect: rect(el), text: norm(el.innerText).slice(0, 300) })),
    listRows: listRows.map((el) => ({ rect: rect(el), text: norm(el.innerText).slice(0, 160) })),
    bodyHead: norm(document.body.innerText).slice(0, 700),
  };
});
console.log(JSON.stringify(info, null, 2));
console.log({ shot: await page.screenshot({ path: "C:/Users/Lenovo/ego/purchase-in-untransferred-20261128/plain-po-0606.png" }) });
