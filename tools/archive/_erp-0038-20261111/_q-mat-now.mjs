import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
let hit = null;
for (let page = 1; page <= 30 && !hit; page++) {
  const r = await kingdeeTryGet(cfg, token, "/jdy/v2/bd/material", { page: String(page), page_size: "300" });
  const rows = (r.data && r.data.rows) || [];
  if (!rows.length) break;
  hit = rows.find((m) => m.number === "YJ-HKB-001") || null;
  if (rows.length < 300) break;
}
if (!hit) { console.log("未找到 YJ-HKB-001"); process.exit(0); }
console.log("列表: number=" + hit.number + " name=" + hit.name + " modify_time=" + hit.modify_time + " is_batch=" + hit.is_batch);
const d = await kingdeeGet(cfg, token, "/jdy/v2/bd/material_detail", { id: String(hit.id) });
console.log("详情: modify_time=" + d.modify_time);
console.log("custom_field=" + JSON.stringify(d.custom_field));
const qc = Object.keys(d).filter(k => /qc|insp|check|quality|test/i.test(k));
console.log("检验相关键: " + (qc.map(k => k + "=" + JSON.stringify(d[k])).join(" | ") || "(无)"));
