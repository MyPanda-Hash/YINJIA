import { readFileSync } from "node:fs";
import { login, queryPanel } from "./api.mjs";
const list = JSON.parse(readFileSync("cleanup-list.json","utf8"));
const ALL = new Set([...list.recv.map(r=>r.no), ...list.insp.map(r=>r.no), "TH-2026-10-0003","TH-2026-10-0005","TH-2026-10-0006"]);
await login();
const seen = new Set(); let page = 1; let hits = 0; const samples = [];
for (;;) {
  const d = await queryPanel("STOCK_LEDGER", { pageNo: page, pageSize: 500 });
  const rows = d.list || [];
  if (!rows.length) { console.log("page", page, "空，停止；totalSize=", d.totalSize); break; }
  let fresh = 0;
  for (const r of rows) {
    const key = JSON.stringify(r).slice(0, 200);
    if (seen.has(key)) continue; seen.add(key); fresh++;
    for (const [k, v] of Object.entries(r)) if (typeof v === "string" && ALL.has(v.trim())) { hits++; if (samples.length<10) samples.push(`${r["单据编号"]} . ${k} = ${v}`); }
  }
  console.log("page", page, "rows", rows.length, "fresh", fresh, "累计", seen.size);
  if (!fresh) break;
  page++;
  if (page > 40) break;
}
console.log("去重后扫描:", seen.size, "命中:", hits);
for (const s of samples) console.log("  ", s);
