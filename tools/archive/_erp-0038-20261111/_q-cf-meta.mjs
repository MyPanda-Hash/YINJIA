import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
const paths = [
  "/jdy/v2/sys/custom_mult_field",
  "/jdy/v2/sys/custom_field",
  "/jdy/v2/bd/custom_field",
  "/jdy/v2/sys/field",
  "/jdy/v2/sys/custom_field_list",
];
for (const p of paths) {
  const r = await kingdeeTryGet(cfg, token, p, { page: "1", page_size: "10" });
  const d = r.data;
  const rows = (d && d.rows) || [];
  console.log(p, "→", r.ok ? "OK count=" + (d && d.count) + " rows=" + rows.length : "FAIL " + r.error);
  if (r.ok && rows[0]) console.log("   键: " + Object.keys(rows[0]).join(",") + "\n   样例: " + JSON.stringify(rows[0]).slice(0, 400));
}
