// round-02: 放大视口 + 载入 0147 + 量取关键元素位置 + 裸截图
const task = await taskSpace(17);
const page = task.page("p1");
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 1680, height: 1500, deviceScaleFactor: 1, mobile: false });
await page.goto("http://localhost:5173/#/panelx/list/PURCHASE_IN?docNo=PI-2026-09-0147", { timeout: 40000 });
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  // 明细行:含 YJ-AJ-017 的表格行
  const rows = [...document.querySelectorAll("table tr")].filter((tr) => norm(tr.innerText).includes("YJ-AJ-017"));
  // 左侧选单列表行
  const listRows = [...document.querySelectorAll("table tr")].filter((tr) => norm(tr.innerText).includes("PI-2026-09-0147"));
  // 表头字段「采购订单号」
  const leaves = [...document.querySelectorAll("div,span,td,label")].filter((el) => el.children.length === 0 && norm(el.textContent) === "采购订单号");
  return {
    docHeight: document.documentElement.scrollHeight,
    viewport: { w: innerWidth, h: innerHeight },
    detailRows: rows.map((el) => ({ rect: rect(el), text: norm(el.innerText).slice(0, 120) })),
    listRows: listRows.map((el) => ({ rect: rect(el), text: norm(el.innerText).slice(0, 120) })),
    poLabel: leaves.map((el) => ({ rect: rect(el), parentText: norm(el.parentElement.innerText).slice(0, 80) })),
  };
});
console.log(JSON.stringify(info, null, 2));

const p = "C:/Users/Lenovo/ego/purchase-in-untransferred-20261128/plain-0147.png";
console.log({ shot: await page.screenshot({ path: p }) });
