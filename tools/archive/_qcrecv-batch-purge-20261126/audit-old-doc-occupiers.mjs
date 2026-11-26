import { readFileSync } from "node:fs";
import { queryPanel } from "./api.mjs";
const out = JSON.parse(readFileSync("occ-audit.json","utf8"));
const bad = out.filter(o=>o.判定==="剩余0"||o.判定==="剩余<未入库");
const pos = [...new Set(bad.map(o=>o.po))];
const oldDocs = [];
for (const po of pos) {
  const d = await queryPanel("QC_RECV", { keyword: po, pageSize: 50 });
  for (const x of (d.list||[])) if (/^(2026-09|2026-10)/.test(String(x["单据日期"]))) oldDocs.push(`${po} ← ${x["单号"]}(${x["单据日期"]},${x["单据状态"]})`);
}
console.log("被占订单:", pos.length, "涉及行:", bad.length);
console.log("占用人是 9-10 月单据的:", oldDocs.length ? oldDocs.join(" ; ") : "无（全部为 11 月真实暂收单）");
