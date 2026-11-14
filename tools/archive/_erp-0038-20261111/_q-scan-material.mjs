import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
const M = process.argv[2] || "YJ-HKB-001";
const list = await kingdeeGet(cfg, token, "/jdy/v2/scm/pur_inbound", { page: "1", page_size: "60" });
const rows = list.rows || [];
console.log("扫描最近 " + rows.length + " 张采购入库单，找商品 " + M);
let hit = 0;
for (const r of rows) {
  const d = await kingdeeGet(cfg, token, "/jdy/v2/scm/pur_inbound_detail", { id: String(r.id) });
  const lines = (d.material_entity || []).filter((e) => e.material_number === M);
  if (!lines.length) continue;
  hit++;
  for (const e of lines) console.log("  " + d.bill_no + " | " + d.bill_date + " | " + d.bill_status + " | qty=" + e.qty + " src=" + (e.src_bill_no || "无来源单") + "/" + (e.src_seq || "-") + " | remark=" + d.remark);
}
console.log("命中 " + hit + " 张");
