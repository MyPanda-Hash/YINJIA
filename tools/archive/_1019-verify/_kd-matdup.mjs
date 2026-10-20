import { readFileSync } from "node:fs"
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs"
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url), "utf8"))
const { token } = await fetchAppToken(cfg.kingdee)
const all = []
for (let p = 1; p <= 8; p++) {
  const r = await kingdeeTryGet(cfg.kingdee, token, "/jdy/v2/bd/material", { page: p, page_size: 300 })
  const rows = r.ok ? (r.data?.rows || []) : []
  if (!rows.length) break
  all.push(...rows)
}
const byNo = new Map()
for (const m of all) { const k = m.number || m.material_number; if (!byNo.has(k)) byNo.set(k, []); byNo.get(k).push(m.id) }
for (const no of ["A-32-01", "A-32-01**TB", "A-32-09"]) console.log(no, "ids:", JSON.stringify(byNo.get(no) || null))
console.log("总商品", all.length, "唯编码", byNo.size)
