import { post } from "./api.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const lines = JSON.parse(readFileSync("open-lines.json","utf8"));
const byPo = {};
for (const l of lines) (byPo[l.po] ||= []).push(l);
const pos = Object.keys(byPo);
console.log("待查订单:", pos.length);
const out = []; let zero = 0, partial = 0, full = 0, missing = 0;
for (let i=0;i<pos.length;i++) {
  const po = pos[i];
  const r = await post("/px/voucherFlow/sources", { sourcePanel:"PU_ORDER", targetPanel:"QC_RECV", condition:{ 单据编号: po }, pageNo:1, pageSize:100 });
  const list = r.body.data?.list || [];
  const srcRows = list.flatMap(d=>(d.detail?.items||[]).map(it=>({ key:String(it["_lineKey"]||""), inv:String(it["物料编码"]||""), left:Number(it["剩余数量"]||0), used:Number(it["已生单数量"]||0), qty:Number(it["数量"]||0) })));
  for (const l of byPo[po]) {
    const hit = srcRows.find(s=>s.inv===l.inv && s.qty===l.qty) || srcRows.find(s=>s.inv===l.inv);
    let status, left;
    if (!hit) { status="选单无此行"; left=null; missing++; }
    else { left=hit.left; status = left<=1e-6 ? "剩余0" : (left<l.un-1e-6 ? "剩余<未入库" : "剩余≥未入库"); if(left<=1e-6)zero++; else if(left<l.un-1e-6)partial++; else full++; }
    out.push({ ...l, 剩余: left, 判定: status });
  }
  if ((i+1)%100===0) console.log("  进度", i+1, "/", pos.length);
}
writeFileSync("occ-audit.json", JSON.stringify(out, null, 1), "utf8");
const cnt = {}; for (const o of out) cnt[o.判定]=(cnt[o.判定]||0)+1;
console.log("行判定分布:", JSON.stringify(cnt));
console.log("涉及订单:", [...new Set(out.filter(o=>o.判定!=="选单无此行"&&o.判定!=="剩余≥未入库").map(o=>o.po))].length);
