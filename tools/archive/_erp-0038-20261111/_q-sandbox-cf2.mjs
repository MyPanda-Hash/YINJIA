import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const raw = JSON.parse(readFileSync(resolve("deploy/push/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
raw.outerInstanceId = raw.sandboxInstanceId;
const { token, domain } = await fetchAppToken(raw); raw.domain = domain;
const KEY = "custom_field__1__62jiaob3z7yj97";
let yes = [], scanned = 0, found = null;
for (let page = 1; page <= 10; page++) {
  const r = await kingdeeTryGet(raw, token, "/jdy/v2/bd/material", { page: String(page), page_size: "100" });
  const rows = (r.ok && r.data && r.data.rows) || [];
  if (!rows.length) break;
  for (const m of rows) {
    scanned++;
    if (m.number === "CL004") found = m;
    // 只对少量商品取详情,避免 100+ 次调用:优先 CL004 与带"滤芯/棉"的
    if (m.number === "CL004") {
      const d = await kingdeeGet(raw, token, "/jdy/v2/bd/material_detail", { id: String(m.id) });
      console.log("CL004 " + d.name + " → " + JSON.stringify(d.custom_field));
    }
  }
  if (rows.length < 100) break;
}
console.log("沙箱商品扫描 " + scanned + " 条,CL004 " + (found ? "存在" : "未在前 1000 条"));
