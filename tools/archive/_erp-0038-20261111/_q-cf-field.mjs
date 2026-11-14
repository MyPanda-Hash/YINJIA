import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
const want = ["YJ-XH-001", "YJ-TJHZ-001", "YJ-HKB-001", "YJ-YCYX-020"];
const found = {};
for (let page = 1; page <= 20 && Object.keys(found).length < want.length; page++) {
  const r = await kingdeeTryGet(cfg, token, "/jdy/v2/bd/material", { page: String(page), page_size: "300" });
  const rows = (r.ok && r.data && r.data.rows) || [];
  if (!rows.length) break;
  for (const m of rows) if (want.includes(m.number)) found[m.number] = m;
  if (rows.length < 300) break;
}
for (const no of want) {
  if (!found[no]) { console.log(no + " 未在商品列表前 6000 条命中"); continue; }
  const d = await kingdeeGet(cfg, token, "/jdy/v2/bd/material_detail", { id: String(found[no].id) });
  console.log("\n=== " + no + " " + d.name + " ===");
  console.log("custom_field = " + JSON.stringify(d.custom_field));
}
