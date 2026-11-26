import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAppToken, kingdeeGet } from "../../../deploy/kingdee-client.mjs";
const HERE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "deploy");
const cfg = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const tk = await fetchAppToken(cfg); cfg.domain = tk.domain || cfg.domain;
const n = (v) => (v === undefined || v === null ? "" : String(v));
// 部署 #75 完成时间 2026-11-27 00:08 (+08) = 2026-11-26T16:08Z
const since = Date.UTC(2026, 10, 26, 16, 8, 0);
const until = Date.now();
const list = await kingdeeGet(cfg, tk.token, "/jdy/v2/scm/pur_inbound", { page: "1", page_size: "50", modify_start_time: String(since), modify_end_time: String(until) });
console.log(`部署后(00:08 起)金蝶采购入库单: count=${list.count}`);
for (const r of list.rows || []) {
  const d = await kingdeeGet(cfg, tk.token, "/jdy/v2/scm/pur_inbound_detail", { id: String(r.id) });
  const srcs = (d.material_entity || []).map((e) => `${n(e.material_number)}x${n(e.qty)}→${n(e.src_bill_no)}#${n(e.src_seq)}`);
  console.log(` ${n(r.bill_no)} 创建=${n(r.create_time)} 状态=${n(r.bill_status)} 源单: ${srcs.join(", ")}`);
}
