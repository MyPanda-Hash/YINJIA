import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const { token, domain } = await fetchAppToken(cfg); cfg.domain = domain;
const tries = [
  { entity: "material" }, { entity: "bd_material" }, { form_id: "bd_material" },
  { bizType: "material" }, { type: "material" }, { entity: "pur_inbound" },
];
for (const t of tries) {
  const r = await kingdeeTryGet(cfg, token, "/jdy/v2/sys/custom_mult_field", { ...t });
  const d = r.data || {};
  console.log(JSON.stringify(t), "→", r.ok ? "ok rows=" + ((d.rows||[]).length) + " keys=" + JSON.stringify(Object.keys(d)).slice(0,120) : "FAIL " + r.error);
  if (r.ok && (d.rows||[]).length) console.log("   样例: " + JSON.stringify(d.rows[0]).slice(0, 500));
  if (!r.ok) console.log("   " + JSON.stringify(r.error).slice(0,200));
}
