import { readFileSync } from "node:fs"
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs"
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url), "utf8"))
const { token } = await fetchAppToken(cfg.kingdee)
const hits = []
for (let p = 1; p <= 10; p++) {
  const r = await kingdeeTryGet(cfg.kingdee, token, "/jdy/v2/scm/inventory", { page: p, page_size: 200 })
  const rows = r.ok ? (r.data?.rows || []) : []
  if (!rows.length) break
  for (const x of rows) if (Number(x.qty) > 0) hits.push(x)
}
console.log("有库存行", hits.length)
for (const x of hits.filter(h => h.stock_number === "CP-02").slice(0, 10)) {
  console.log([x.material_number, x.material_name, x.stock_number, x.batch_no, x.qty].join(" | "))
}
