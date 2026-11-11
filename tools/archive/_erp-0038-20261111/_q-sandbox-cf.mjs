import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const raw = JSON.parse(readFileSync(resolve("deploy/push/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
raw.outerInstanceId = raw.sandboxInstanceId;
const { token, domain } = await fetchAppToken(raw); raw.domain = domain;
console.log("沙箱 clientId=" + raw.clientId + " instance=" + raw.outerInstanceId);
const l = await kingdeeTryGet(raw, token, "/jdy/v2/bd/material", { page: "1", page_size: "5", number: "CL004" });
const rows = (l.ok && l.data && l.data.rows) || [];
const hit = rows.find((r) => r.number === "CL004") || rows[0];
if (!hit) { console.log("沙箱商品列表无 CL004：" + JSON.stringify((l.data||l.error)).slice(0,300)); }
else {
  const d = await kingdeeGet(raw, token, "/jdy/v2/bd/material_detail", { id: String(hit.id) });
  console.log("商品 " + d.number + " " + d.name);
  console.log("custom_field = " + JSON.stringify(d.custom_field));
}
