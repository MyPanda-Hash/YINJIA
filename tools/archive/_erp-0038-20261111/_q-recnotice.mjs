import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
for (const p of ["/jdy/v2/scm/pur_mat_rec_notice"]) {
  const r = await kingdeeTryGet(cfg, token, p, { page: "1", page_size: "20" });
  console.log(p, "→", r.ok ? "OK rows=" + ((r.data&&r.data.rows)||[]).length : "FAIL " + r.error);
  if (r.ok) {
    console.log("  键:", Object.keys(((r.data&&r.data.rows)||[])[0] || {}).join(","));
    for (const x of ((r.data&&r.data.rows)||[]).slice(0,10)) console.log("  " + [x.bill_no, x.bill_date, x.bill_status, x.supplier_name].join(" | "));
  }
}
