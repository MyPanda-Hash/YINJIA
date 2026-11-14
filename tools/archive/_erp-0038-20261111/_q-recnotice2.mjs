import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
for (const params of [{ page: "1", page_size: "20" }, { page: "1", page_size: "20", bill_status: "C" }]) {
  const r = await kingdeeTryGet(cfg, token, "/jdy/v2/scm/pur_mat_rec_notice", params);
  console.log(JSON.stringify(params), "→ ok=" + r.ok, JSON.stringify(r.data || r.error).slice(0, 600));
}
