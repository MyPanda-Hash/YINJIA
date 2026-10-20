import { readFileSync } from "node:fs"
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs"
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url), "utf8"))
const { token } = await fetchAppToken(cfg.kingdee)
for (const p of ["/jdy/v2/scm/inventory_stock", "/jdy/v2/scm/inventory"]) {
  const r = await kingdeeTryGet(cfg.kingdee, token, p, { page: 1, page_size: 100 })
  if (!r.ok) { console.log(p, "ERR", r.error); continue }
  const rows = r.data?.rows || r.data || []
  console.log(p, "rows", Array.isArray(rows) ? rows.length : typeof rows, Array.isArray(rows) && rows[0] ? Object.keys(rows[0]).slice(0,8).join(",") : "")
  for (const x of (Array.isArray(rows) ? rows : []).slice(0, 40)) {
    console.log("  ", [x.material_number, x.material_name, x.stock_number, x.stock_name, x.qty, x.real_qty].join(" | "))
  }
}
