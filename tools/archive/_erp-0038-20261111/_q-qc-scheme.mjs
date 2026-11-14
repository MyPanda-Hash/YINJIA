import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
// 1) 商品类别 001(炭粉) 详情里有没有检验相关设置
const g = await kingdeeTryGet(cfg, token, "/jdy/v2/bd/material_group_detail", { id: "2167738972682336256" });
console.log("类别详情 ok=" + g.ok);
if (g.ok) {
  const d = g.data || {};
  const keys = Object.keys(d);
  console.log("键: " + keys.join(","));
  const qc = keys.filter(k => /qc|insp|check|quality/i.test(k));
  console.log("检验相关: " + (qc.map(k => k + "=" + JSON.stringify(d[k])).join(" | ") || "(无)"));
}
// 2) 试探 质检方案/检验类型 类接口是否存在
for (const p of ["/jdy/v2/qm/qc_scheme", "/jdy/v2/scm/qc_scheme", "/jdy/v2/bd/qc_scheme", "/jdy/v2/qm/inspect", "/jdy/v2/scm/pur_inspect", "/jdy/v2/sys/param"]) {
  const r = await kingdeeTryGet(cfg, token, p, { page: "1", page_size: "3" });
  console.log(p, r.ok ? "OK rows=" + (((r.data||{}).rows||[]).length) : "FAIL " + r.error);
}
