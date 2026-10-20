import { readFileSync } from "node:fs"
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs"
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url), "utf8"))
const { token } = await fetchAppToken(cfg.kingdee)
let out = []
for (let page = 1; page <= 12; page++) {
  const r = await kingdeeTryGet(cfg.kingdee, token, "/jdy/v2/scm/inventory", { page, page_size: 200 })
  if (!r.ok) { console.log("ERR", r.error); break }
  const rows = r.data?.rows || []
  if (!rows.length) break
  for (const x of rows) if (Number(x.qty) > 0) out.push([x.stock_number, x.stock_name, x.material_number, x.material_name, x.qty])
}
console.log("有库存行", out.length)
const byWh = {}
for (const r of out) byWh[r[0]] = (byWh[r[0]] || 0) + 1
console.log("按仓:", JSON.stringify(byWh))
for (const r of out.filter(r => r[0] === "CK00001").slice(0, 20)) console.log("  CK00001:", r.join(" | "))
for (const r of out.slice(0, 12)) console.log("  any:", r.join(" | "))
