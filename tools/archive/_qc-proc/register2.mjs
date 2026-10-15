#!/usr/bin/env node
/** 登记本次新增的迁移脚本进 tools/db-migrations.txt(清单唯一权威)。 */
import fs from "node:fs";

const MIG = "D:\\workspace\\yinjia\\tools\\db-migrations.txt";
let s = fs.readFileSync(MIG, "utf8");
const add = [];
for (const f of ["fix-qc-proc-insp-report-i18n.sql"]) {
  if (!s.includes(f)) add.push(f);
}
if (add.length) {
  if (!s.endsWith("\n")) s += "\n";
  s += add.join("\n") + "\n";
  fs.writeFileSync(MIG, s, "utf8");
}
console.log("ADDED=" + JSON.stringify(add));
for (const f of ["migrate-qc-proc-insp.sql", "fix-qc-proc-insp-i18n.sql", "fix-qc-proc-insp-report-i18n.sql"]) {
  console.log("  " + f + " -> " + fs.readFileSync(MIG, "utf8").includes(f));
}
