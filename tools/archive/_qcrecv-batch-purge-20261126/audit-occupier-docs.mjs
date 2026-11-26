import { readFileSync } from "node:fs";
import { queryPanel } from "./api.mjs";
const out = JSON.parse(readFileSync("occ-audit.json","utf8"));
const pos = [...new Set(out.filter(o=>o.判定==="剩余0"||o.判定==="剩余<未入库").map(o=>o.po))];
for (const po of pos) {
  const d = await queryPanel("QC_RECV", { keyword: po, pageSize: 50 });
  const docs = (d.list||[]).filter(x => (x.detail?.items||[]).some(i=>String(i["采购单号"]||"")===po) || String(x["采购订单号"]||"")===po);
  console.log(`\n${po}  相关暂收单 ${docs.length} 张`);
  for (const x of docs) {
    const items = (x.detail?.items||[]).filter(i=>String(i["采购单号"]||"")===po).map(i=>`${i["物料编码"]}×${i["数量"]}(行${i["采购订单行号"]})`);
    console.log("   ", x["单号"], x["单据日期"], x["单据状态"], x["审核人"]??"(空)", x["审核时间"]??"", "|", items.join(" "));
  }
}
