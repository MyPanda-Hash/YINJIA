import { readFileSync } from "node:fs"
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs"
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url), "utf8"))
const { token } = await fetchAppToken(cfg.kingdee)
for (const no of ["A-32-01", "Y-S-T"]) {
  const r = await kingdeeTryGet(cfg.kingdee, token, "/jdy/v2/bd/material", { number: no, page: 1, page_size: 5 })
  const rows = r.ok ? (r.data?.rows || []) : []
  for (const m of rows) console.log(no, "->", m.number, m.name, "base_unit:", m.base_unit_number || m.base_unit_name, "unit:", m.unit_number || m.unit_name, "is_batch:", m.is_batch)
  if (!rows.length) console.log(no, "未命中", r.error || "")
}
