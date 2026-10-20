import { readFileSync } from "node:fs"
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs"
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url), "utf8"))
const { token } = await fetchAppToken(cfg.kingdee)
const r = await kingdeeTryGet(cfg.kingdee, token, "/jdy/v2/bd/material", { page: 1, page_size: 500 })
const rows = r.ok ? (r.data?.rows || []) : []
console.log("total rows", rows.length)
for (const no of ["A-32-01", "A-32-09", "Y-S-T", "CL004"]) {
  const m = rows.find(x => (x.number || x.material_number) === no)
  if (m) console.log(no, "=>", JSON.stringify({ base_unit_number: m.base_unit_number, base_unit_name: m.base_unit_name, unit_number: m.unit_number, unit_name: m.unit_name, is_batch: m.is_batch }))
  else console.log(no, "未找到")
}
const units = await kingdeeTryGet(cfg.kingdee, token, "/jdy/v2/bd/measure_unit", { page: 1, page_size: 100 })
console.log("units:", (units.data?.rows || []).map(u => (u.number || u.name) + '/' + (u.name || '')).join(', '))
