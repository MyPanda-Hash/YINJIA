import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
const list = await kingdeeGet(cfg, token, "/jdy/v2/scm/pur_inbound", { page: "1", page_size: "12" });
console.log("金蝶最近 12 张采购入库单(create_time 倒序)");
for (const r of (list.rows || [])) console.log([r.bill_no, r.bill_date, r.create_time, (r.remark || "").trim()].join(" | "));
