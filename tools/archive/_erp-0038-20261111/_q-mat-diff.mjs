import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
const want = ["YJ-HKB-001", "YJ-YCYX-020"];
const found = {};
for (let page = 1; page <= 20 && Object.keys(found).length < want.length; page++) {
  const r = await kingdeeTryGet(cfg, token, "/jdy/v2/bd/material", { page: String(page), page_size: "300" });
  const rows = (r.ok && r.data && r.data.rows) || [];
  if (!rows.length) break;
  for (const m of rows) if (want.includes(m.number)) found[m.number] = m;
  if (rows.length < 300) break;
}
const det = {};
for (const no of want) if (found[no]) det[no] = await kingdeeGet(cfg, token, "/jdy/v2/bd/material_detail", { id: String(found[no].id) });
const a = det[want[0]], b = det[want[1]];
if (!a || !b) { console.log("缺数据", Object.keys(det)); process.exit(0); }
const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
console.log("=== 两个商品的档案差异(只列不同的键) ===");
for (const k of keys) {
  const va = JSON.stringify(a[k]), vb = JSON.stringify(b[k]);
  if (va !== vb) console.log(k + ":\n   " + want[0] + " = " + (va||"").slice(0,200) + "\n   " + want[1] + " = " + (vb||"").slice(0,200));
}
