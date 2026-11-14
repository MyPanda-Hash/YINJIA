import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
const list = await kingdeeGet(cfg, token, "/jdy/v2/scm/pur_inbound", { page: "1", page_size: "40" });
const rows = list.rows || [];
console.log("金蝶最近采购入库单(按创建倒序,共 " + rows.length + " 条)");
for (const r of rows) console.log([r.bill_no, r.bill_date, r.bill_status, r.create_time, r.remark].join(" | "));
