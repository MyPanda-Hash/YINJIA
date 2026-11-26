import { queryPanel } from "./api.mjs";
import { writeFileSync } from "node:fs";
const all = []; let page = 1;
while (true) {
  const d = await queryPanel("PU_ORDER", { pageNo: page, pageSize: 200 });
  const list = d.list || [];
  if (!list.length) break;
  all.push(...list);
  if (all.length >= d.totalSize) break;
  page++;
}
console.log("抓取订单:", all.length);
writeFileSync("PU_ORDER_ALL.json", JSON.stringify(all), "utf8");
const open = all.filter(p => p["单据状态"] === "已审核");
console.log("已审核(可选单):", open.length);
let openLines = 0; const withUn = [];
for (const p of open) {
  for (const it of (p.detail?.items || [])) {
    openLines++;
    const un = Number(it["金蝶未入库数量"] ?? 0);
    if (un > 1e-6) withUn.push({ po: p["单据编号"], line: String(it["行号"]).replace(/\.0+$/,""), inv: it["物料编码"], qty: Number(it["数量"]), in: Number(it["金蝶已入库数量"]??0), un });
  }
}
console.log("已审核订单行:", openLines, "其中金蝶仍有未入库:", withUn.length, "涉及订单:", new Set(withUn.map(x=>x.po)).size);
writeFileSync("open-lines.json", JSON.stringify(withUn, null, 1), "utf8");
