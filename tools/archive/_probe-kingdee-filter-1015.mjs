import { readFileSync } from "node:fs"
import { fetchAppToken, kingdeeTryGet } from "../../deploy/kingdee-client.mjs"
const cfg = JSON.parse(readFileSync(new URL("../../deploy/config.json", import.meta.url), "utf8")).kingdee
const { token } = await fetchAppToken(cfg)
const tests = [
  ["/jdy/v2/scm/inv_product", { material_number: "C-95-12", bill_status: "C", page: "1", page_size: "3" }],
  ["/jdy/v2/scm/inv_product", { material_number: "C-95-12", page: "1", page_size: "3" }],
  ["/jdy/v2/scm/sal_out_bound", { material_number: "C-95-07", bill_status: "C", page: "1", page_size: "3" }],
  ["/jdy/v2/scm/inv_product", { search: "C-95-12", page: "1", page_size: "3" }],
  ["/jdy/v2/scm/inv_product", { page: "1", page_size: "3" }]
]
for (const [p, q] of tests) {
  const r = await kingdeeTryGet(cfg, token, p, q)
  console.log(p, JSON.stringify(q), "=>", r.ok ? `count=${r.data?.count} rows=${(r.data?.rows||[]).length}` : String(r.error).slice(0,90))
  await new Promise(r2 => setTimeout(r2, 250))
}
