#!/usr/bin/env node
/** 登记 migrate-qc-proc-insp-freq-col.sql 到 tools/db-migrations.txt(清单唯一权威)。 */
import fs from "node:fs";

const MIG = "D:\\workspace\\yinjia\\tools\\db-migrations.txt";
let s = fs.readFileSync(MIG, "utf8");
const f = "migrate-qc-proc-insp-freq-col.sql";
if (!s.includes(f)) {
  if (!s.endsWith("\n")) s += "\n";
  s += f + "\n";
  fs.writeFileSync(MIG, s, "utf8");
  console.log("ADDED");
} else {
  console.log("ALREADY");
}
console.log("HAS=" + fs.readFileSync(MIG, "utf8").includes(f));
