import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
const paths = [
  "/jdy/v2/scm/pur_mat_notice", "/jdy/v2/scm/pur_mat_notice_detail",
  "/jdy/v2/scm/pur_receive_notice", "/jdy/v2/scm/pur_receipt_notice",
  "/jdy/v2/scm/pur_mat_rec_notice", "/jdy/v2/scm/pur_inbound",
  "/jdy/v2/qc/qc_bill", "/jdy/v2/qc/inspect_bill", "/jdy/v2/scm/qc_bill",
];
for (const p of paths) {
  const r = await kingdeeTryGet(cfg, token, p, { page: "1", page_size: "3" });
  const d = r.data || {};
  console.log(p.padEnd(38), r.ok ? "OK count=" + (d.count ?? "n/a") + " rows=" + ((d.rows||[]).length) : "FAIL " + r.error);
}
