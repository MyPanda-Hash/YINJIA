import { readFileSync } from "node:fs"
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs"
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url), "utf8"))
const { token } = await fetchAppToken(cfg.kingdee)
const all = []
for (let p = 1; p <= 6; p++) {
  const r = await kingdeeTryGet(cfg.kingdee, token, "/jdy/v2/bd/material", { page: p, page_size: 300 })
  const rows = r.ok ? (r.data?.rows || []) : []
  if (!rows.length) break
  all.push(...rows)
}
console.log("materials", all.length)
for (const no of ["A-32-01","A-32-02","A-32-03","A-32-05","A-32-06","A-32-08","A-32-14","Y-S-T","CL004"]) {
  const m = all.find(x => (x.number || x.material_number) === no)
  console.log(no, m ? JSON.stringify({u: m.base_unit_number, batch: m.is_batch}) : "未找到")
}
