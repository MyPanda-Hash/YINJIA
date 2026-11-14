import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
for (const no of ["CGRK-20261111-03675", "CGRK-20261107-03676", "CGRK-20261107-03654", "CGRK-20261111-03673"]) {
  const l = await kingdeeTryGet(cfg, token, "/jdy/v2/scm/pur_inbound", { page: "1", page_size: "5", bill_no: no });
  const row = l.ok ? ((l.data&&l.data.rows)||[])[0] : null;
  if (!row) { console.log(no + " → 查无: " + (l.ok ? "空" : l.error)); continue; }
  const d = await kingdeeGet(cfg, token, "/jdy/v2/scm/pur_inbound_detail", { id: String(row.id) });
  console.log("\n" + no + " | " + d.bill_date + " | " + d.bill_status + " | remark=" + d.remark);
  for (const e of (d.material_entity||[])) console.log("   行 seq=" + e.seq + " " + e.material_number + " qty=" + e.qty + " src=" + (e.src_bill_no||"-") + "/" + (e.src_seq||"-") + " batch=" + (e.batch_no||"-"));
}
