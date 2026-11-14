import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
async function ord(no) {
  const l = await kingdeeGet(cfg, token, "/jdy/v2/scm/pur_order", { page: "1", page_size: "5", bill_no: no });
  const h = (l.rows || [])[0];
  const d = await kingdeeGet(cfg, token, "/jdy/v2/scm/pur_order_detail", { id: String(h.id) });
  return d;
}
const a = await ord("YJ-20261102-02");   // 失败单 0019 的订单
const b = await ord("YJ-20261103-07");   // 成功单 0038 的订单
console.log("=== 两张订单的表头差异(只列不同) ===");
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  if (k === "material_entity") continue;
  const va = JSON.stringify(a[k]), vb = JSON.stringify(b[k]);
  if (va !== vb) console.log(k + ":  失败单=" + (va||"").slice(0,80) + "  |  成功单=" + (vb||"").slice(0,80));
}
console.log("\n=== 分录键差异(取各自第1行) ===");
const ea = (a.material_entity||[])[0] || {}, eb = (b.material_entity||[])[0] || {};
for (const k of new Set([...Object.keys(ea), ...Object.keys(eb)])) {
  if (/amount|price|discount|tax|cess|cost/i.test(k)) continue;
  const va = JSON.stringify(ea[k]), vb = JSON.stringify(eb[k]);
  if (va !== vb) console.log(k + ":  失败单=" + (va||"").slice(0,60) + "  |  成功单=" + (vb||"").slice(0,60));
}
