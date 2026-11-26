import { readFileSync, writeFileSync } from "node:fs";
const recv = JSON.parse(readFileSync("QC_RECV.json","utf8"));
const insp = JSON.parse(readFileSync("QC_INSP.json","utf8"));
const inspByRecv = {}; for (const i of insp) if (i["暂收单号"]) (inspByRecv[i["暂收单号"]] ||= []).push(i["单据编号"]);
// Excel 批次 = 审核时间恰为 12:00:00 的暂收单（9月 245 + 10月 39）
const batch = recv.filter(r => /12:00:00$/.test(String(r["审核时间"]||"")));
const recvList = batch.map(r => ({ no: r["单号"], status: r["单据状态"], date: r["单据日期"] }));
const inspList = batch.flatMap(r => (inspByRecv[r["单号"]]||[]).map(i=>({ no:i, recv:r["单号"] })));
console.log("批次暂收单:", recvList.length, "检验单:", inspList.length);
console.log("检验单:", inspList.map(x=>x.no+"←"+x.recv).join(", "));
writeFileSync("cleanup-list.json", JSON.stringify({ recv: recvList, insp: inspList }, null, 1), "utf8");
