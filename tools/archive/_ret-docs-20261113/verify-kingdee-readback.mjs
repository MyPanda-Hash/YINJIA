import { readFileSync } from "node:fs";
import { fetchAppToken, kingdeeTryGet } from "../../../deploy/kingdee-client.mjs";
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/push/config.json", import.meta.url), "utf8"));
const sbx = { ...cfg.kingdee, outerInstanceId: cfg.kingdee.sandboxInstanceId };
const { token } = await fetchAppToken(sbx);
const CASES = [
  ["销售退货单", "/jdy/v2/scm/sal_in_bound", "/jdy/v2/scm/sal_in_bound_detail", "XSTH-20261113-00001"],
  ["生产退料单", "/jdy/v2/scm/inv_pick_ret", "/jdy/v2/scm/inv_pick_ret_detail", "SCTL-20261113-00001"],
  ["采购退货单", "/jdy/v2/scm/pur_ret", "/jdy/v2/scm/pur_ret_detail", "CGTH-20261113-00003"],
];
for (const [label, listPath, detailPath, no] of CASES) {
  const l = await kingdeeTryGet(sbx, token, listPath, { page: "1", page_size: "50" });
  const hit = (l.data?.rows || []).find(r => r.bill_no === no);
  console.log(`\n[${label}] ${no} 列表命中=${hit ? "✅" : "❌"}`, hit ? `状态=${hit.bill_status} 日期=${hit.bill_date}` : "");
  if (hit) {
    const d = await kingdeeTryGet(sbx, token, detailPath, { id: hit.id });
    const data = d.data || {};
    const ents = data.material_entity || [];
    console.log(`  详情: 客户/供应商=${data.customer_name || data.supplier_name || "-"} 部门=${data.dept_name || "-"} 备注=${data.remark || "-"}`);
    for (const e of ents) console.log(`  行: ${e.material_number} ${e.material_name} 数量=${e.qty} 单价=${e.price} 单位=${e.unit_name} 仓库=${e.stock_name} 金额=${e.amount}`);
  }
  await new Promise(x=>setTimeout(x,150));
}
