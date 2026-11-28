// server round-07: 视口放大到 2860 → 量 0183 列位置;再看采购订单 YJ-20261110-03
const task = await taskSpace(18);
const page = task.page("p1");
await page.cdp("Emulation.setDeviceMetricsOverride", { width: 2860, height: 1560, deviceScaleFactor: 1, mobile: false });

async function measure(url, anchor) {
  await page.goto(url, { timeout: 60000 });
  await page.waitForTimeout(6000);
  return await page.evaluate((anchor) => {
    const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
    const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
    const all = [...document.querySelectorAll("table tr")];
    const head = all.find((tr) => norm(tr.innerText).includes("源单编号") || norm(tr.innerText).includes("金蝶未入库数量"));
    const data = all.filter((tr) => tr.getBoundingClientRect().width > 500);
    const row = data.find((tr) => norm(tr.innerText).includes(anchor) && tr !== head);
    return {
      hash: location.hash,
      docHeight: document.documentElement.scrollHeight,
      columns: head ? [...head.children].map((th, i) => ({ i, t: norm(th.innerText).replace(/[⇅◫]/g, "").trim(), x: Math.round(th.getBoundingClientRect().left), w: Math.round(th.getBoundingClientRect().width) })) : [],
      anchorRow: row ? { rect: R(row), text: norm(row.innerText) } : null,
      dataRowCount: data.length,
    };
  }, anchor);
}

const a = await measure("http://36.140.66.163:8090/#/panelx/list/PURCHASE_IN?docNo=PI-2026-11-0183", "YJ-SX-011-2");
console.log("=== PIN 0183");
console.log(JSON.stringify(a, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/server-pin-noterp-20261128/plain-0183-wide.png" });

const b = await measure("http://36.140.66.163:8090/#/panelx/list/PU_ORDER?docNo=YJ-20261110-03", "YJ-SX-011-2");
console.log("=== PO YJ-20261110-03");
console.log(JSON.stringify(b, null, 2));
await page.screenshot({ path: "C:/Users/Lenovo/ego/server-pin-noterp-20261128/plain-po-1110.png" });
