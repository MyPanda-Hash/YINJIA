import { readFileSync, writeFileSync } from "node:fs";
const recv = JSON.parse(readFileSync("QC_RECV.json","utf8"));
const insp = JSON.parse(readFileSync("QC_INSP.json","utf8"));
const batch = recv.filter(r => /12:00:00$/.test(String(r["审核时间"]||"")));
const inspByRecv = {}; for (const i of insp) if (i["暂收单号"]) (inspByRecv[i["暂收单号"]] ||= []).push(i["单据编号"]);
const out = ["单号,单据日期,单据状态,审核人,审核时间,采购订单号,物料编码,数量,批次号,关联检验单"];
for (const r of batch) {
  const it = (r.detail?.items||[])[0] || {};
  out.push([r["单号"], r["单据日期"], r["单据状态"], r["审核人"]??"", r["审核时间"]??"", it["采购单号"]||r["采购订单号"]||"", it["物料编码"]||"", it["数量"]??"", it["批次号"]||"", (inspByRecv[r["单号"]]||[]).join("/")].join(","));
}
writeFileSync("deleted-docs.csv", "\uFEFF"+out.join("\n"), "utf8");
console.log("行数:", out.length-1, "检验单行:", out.filter(l=>l.split(",")[9]).length);
