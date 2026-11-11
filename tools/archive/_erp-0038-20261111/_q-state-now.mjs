import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
// 1) 商品 YJ-HKB-001 现状(modify_time 是否刚被改过)
const l = await kingdeeTryGet(cfg, token, "/jdy/v2/bd/material", { page: "1", page_size: "300" });
const rows = (l.data && l.data.rows) || [];
const hit = rows.find((m) => m.number === "YJ-HKB-001");
console.log("商品档案列表 modify_time=" + (hit && hit.modify_time) + " is_batch=" + (hit && hit.is_batch));
if (hit) {
  const d = await kingdeeGet(cfg, token, "/jdy/v2/bd/material_detail", { id: String(hit.id) });
  console.log("详情 modify_time=" + d.modify_time + " custom_field=" + JSON.stringify(d.custom_field));
  const extra = Object.keys(d).filter(k => /qc|insp|check|quality|test/i.test(k));
  console.log("检验相关键: " + extra.map(k => k + "=" + JSON.stringify(d[k])).join(" | "));
}
// 2) 订单行是否还是开着
const o = await kingdeeGet(cfg, token, "/jdy/v2/scm/pur_order", { page: "1", page_size: "5", bill_no: "YJ-20261102-02" });
const oh = (o.rows || [])[0];
const od = await kingdeeGet(cfg, token, "/jdy/v2/scm/pur_order_detail", { id: String(oh.id) });
for (const e of (od.material_entity || [])) console.log("订单行 seq=" + e.seq + " " + e.material_number + " qty=" + e.qty + " in_qty=" + e.in_qty + " close_state=" + e.close_state);
// 3) 收料通知单还是 0 吗
const r = await kingdeeTryGet(cfg, token, "/jdy/v2/scm/pur_mat_rec_notice", { page: "1", page_size: "5" });
console.log("收料通知单 count=" + ((r.data && r.data.count) ?? "n/a"));
