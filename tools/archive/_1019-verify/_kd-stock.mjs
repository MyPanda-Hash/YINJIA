import { kingdeeGet } from "../../../deploy/kingdee-client.mjs"
const d = await kingdeeGet("/jdy/v2/scm/inventory_stock", { page: 1, page_size: 200 })
const rows = d.data?.rows || d.rows || d.data || []
console.log("rows", Array.isArray(rows) ? rows.length : typeof rows)
for (const r of (Array.isArray(rows) ? rows : []).slice(0, 80)) {
  const q = Number(r.qty ?? r.stock_qty ?? r.base_qty ?? 0)
  if (q > 0) console.log([r.material_number, r.material_name, r.stock_number, r.stock_name, r.qty].join(" | "))
}
