import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
const paths = [
  "/jdy/v2/scm/pur_receive", "/jdy/v2/scm/pur_receive_notice", "/jdy/v2/scm/pur_receipt",
  "/jdy/v2/scm/pur_notice", "/jdy/v2/scm/receive_notice", "/jdy/v2/scm/pur_arrival",
  "/jdy/v2/qc/inspect", "/jdy/v2/qc/qc_bill", "/jdy/v2/scm/qc_inspect",
  "/jdy/v2/bd/material_group", "/jdy/v2/scm/pur_inbound",
];
for (const p of paths) {
  const r = await kingdeeTryGet(cfg, token, p, { page: "1", page_size: "3" });
  const rows = r.ok ? ((r.data && r.data.rows) || []) : [];
  console.log(p, "→", r.ok ? `OK rows=${rows.length} total=${r.data && r.data.total}` : "FAIL " + r.error);
  if (r.ok && rows[0]) console.log("   样例:", Object.keys(rows[0]).slice(0, 14).join(","));
}
