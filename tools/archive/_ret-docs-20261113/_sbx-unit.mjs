import { readFileSync } from "node:fs";
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/push/config.json", import.meta.url), "utf8"));
const sbx = { ...cfg.kingdee, outerInstanceId: cfg.kingdee.sandboxInstanceId };
const { token } = await fetchAppToken(sbx);
const all = [];
for (let p = 1; p <= 4; p++) {
  const r = await kingdeeTryGet(sbx, token, "/jdy/v2/bd/material", { page: String(p), page_size: "100" });
  if (!r.ok) break;
  all.push(...(r.data.rows || []));
  if (p >= (r.data.total_page || 1)) break;
  await new Promise(x=>setTimeout(x,120));
}
const hit = all.filter(m => ["YJ-AJ-016-1","YJ-AJ-016-2","YJ-AJ-017"].includes(m.number));
console.log("materials:", all.length);
console.log(JSON.stringify(hit.map(m=>[m.number,m.name,m.base_unit_name,m.base_unit_number,m.base_unit_id])));
