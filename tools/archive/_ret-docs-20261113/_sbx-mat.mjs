import { readFileSync } from "node:fs";
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/push/config.json", import.meta.url), "utf8"));
const sbx = { ...cfg.kingdee, outerInstanceId: cfg.kingdee.sandboxInstanceId };
const { token } = await fetchAppToken(sbx);
let page = 1, total = 1; const all = [];
do {
  const r = await kingdeeTryGet(sbx, token, "/jdy/v2/bd/material", { page: String(page), page_size: "100" });
  if (!r.ok) { console.log("ERR", r.error); break; }
  total = r.data.total_page || 1;
  all.push(...(r.data.rows || []));
  page += 1;
  await new Promise(x=>setTimeout(x,120));
} while (page <= total);
console.log("materials:", all.length);
for (const code of ["C-95-13","CL002","C-95-14"]) {
  const m = all.find(x => x.number === code);
  console.log(code, m ? JSON.stringify({ name: m.name, unit: m.base_unit_name || m.unit_name || m.base_unit_number, keys: Object.keys(m).slice(0,10) }) : "NOT FOUND");
}
const units = await kingdeeTryGet(sbx, token, "/jdy/v2/bd/measure_unit", { page: "1", page_size: "100" });
console.log("units:", JSON.stringify((units.data?.rows||[]).map(u=>u.number)));
