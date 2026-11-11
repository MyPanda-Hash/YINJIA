import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
// 模糊找所有以 YJ-20261102-02 开头的订单号(防"同号两张单")
const r = await kingdeeTryGet(cfg, token, "/jdy/v2/scm/pur_order", { page: "1", page_size: "50", bill_no: "YJ-20261102" });
const rows = (r.data && r.data.rows) || [];
console.log("bill_no 模糊 YJ-20261102 命中 " + rows.length + " 张:");
for (const x of rows) console.log("  " + [x.bill_no, x.bill_date, x.bill_status, x.bill_close_state, x.io_status, x.supplier_number].join(" | "));
