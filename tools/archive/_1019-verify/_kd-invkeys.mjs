import { readFileSync } from "node:fs"
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs"
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/config.json", import.meta.url), "utf8"))
const { token } = await fetchAppToken(cfg.kingdee)
const r = await kingdeeTryGet(cfg.kingdee, token, "/jdy/v2/scm/inventory", { page: 1, page_size: 5 })
const rows = r.data?.rows || []
console.log("keys:", Object.keys(rows[0] || {}).join(","))
console.log(JSON.stringify(rows[0], null, 1).slice(0, 1200))
