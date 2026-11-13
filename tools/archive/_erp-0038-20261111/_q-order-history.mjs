import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
const M = "YJ-HKB-001";
const l = await kingdeeTryGet(cfg, token, "/jdy/v2/scm/pur_order", { page: "1", page_size: "30", supplier_number: "YJ-HKB" });
const rows = (l.ok && l.data && l.data.rows) || [];
console.log("供应商 YJ-HKB 订单列表命中 " + rows.length + " 张(过滤器未必生效)");
let n = 0;
for (const r of rows.slice(0, 30)) {
  if (r.supplier_number !== "YJ-HKB") continue;
  const d = await kingdeeGet(cfg, token, "/jdy/v2/scm/pur_order_detail", { id: String(r.id) });
  const hit = (d.material_entity || []).filter((e) => e.material_number === M);
  if (!hit.length) continue;
  n++;
  console.log("\n" + d.bill_no + " | " + d.bill_date + " | " + d.bill_status + " | 整单关闭=" + d.bill_close_state);
  for (const e of hit) console.log("   seq=" + e.seq + " qty=" + e.qty + " in_qty=" + e.in_qty + " close_state=" + e.close_state);
}
console.log("\n含该商品的订单 " + n + " 张");
