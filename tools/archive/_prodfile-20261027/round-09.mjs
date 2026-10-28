const task = await taskSpace("prodfile-1027-20261027");
const page = task.page("p1");
const fs = await import("node:fs/promises");

const BASE = "http://127.0.0.1:4173/";
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForSelector("#app > *:not(#boot-tip)", { state: "visible", timeout: 25000 });

const raw = await page.evaluate(async () => {
  const tk = localStorage.getItem("mes_token") || localStorage.getItem("token") || "";
  const r = await fetch("/api/px/getPanelConfig?panelCode=RD_MOLD_PROC", { headers: { Authorization: "Bearer " + tk } });
  const txt = await r.text();
  return txt;
});
console.log("LEN=" + raw.length);
// 直接找关键字在该 JSON 里的上下文
const idx = raw.indexOf("产品管控");
console.log("IDX_产品管控=" + idx);
if (idx >= 0) console.log("CTX=" + raw.slice(Math.max(0, idx - 400), idx + 600));
const idx2 = raw.indexOf("产品形态");
console.log("IDX_产品形态=" + idx2);
if (idx2 >= 0) console.log("CTX2=" + raw.slice(Math.max(0, idx2 - 300), idx2 + 400));
console.log("HEAD=" + raw.slice(0, 500));

await fs.writeFile("C:/INCER/YINJIA-MES/_scratch/ego-prodfile-1027/panelconfig-raw.json", raw, "utf8");
await task.finish({ keep: [] });
