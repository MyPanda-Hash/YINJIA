#!/usr/bin/env node
/**
 * 把新建的制程检验单迁移登记进:
 *   ① tools/db-migrations.txt        —— 迁移链清单(唯一权威)
 *   ② tools/db-inuse-tables.txt      —— 在册表台账
 * 用 Node 以 UTF-8 追加,避免 PowerShell 管道破坏中文。
 * 运行: node tools/archive/_qc-proc/register.mjs
 */
import fs from "node:fs";

const T = "D:\\workspace\\yinjia\\tools\\";
const MIG = T + "db-migrations.txt";
const INUSE = T + "db-inuse-tables.txt";

// ① 迁移清单:追加两行(若未登记)
{
  let s = fs.readFileSync(MIG, "utf8");
  const add = [];
  if (!s.includes("migrate-qc-proc-insp.sql")) add.push("migrate-qc-proc-insp.sql");
  if (!s.includes("fix-qc-proc-insp-i18n.sql")) add.push("fix-qc-proc-insp-i18n.sql");
  if (add.length) {
    if (!s.endsWith("\n")) s += "\n";
    s += add.join("\n") + "\n";
    fs.writeFileSync(MIG, s, "utf8");
  }
  console.log("MIGRATIONS_ADDED=" + JSON.stringify(add));
}

// ② 在册台账:插到 qc_fin_spec_head 之前(保持 qc_ 组内字母序观感)
{
  let s = fs.readFileSync(INUSE, "utf8");
  const rows = [
    "table:qc_proc_insp_detail   # 制程检验单行表——面板 QC_PROC_INSP 明细(表区=外观/尺寸/重量/功能性测试;尺寸与重量实测可含多个抽样值;migrate-qc-proc-insp.sql 新建)",
    "table:qc_proc_insp_head   # 制程检验单头表——面板 QC_PROC_INSP(2026-10-12 按《生产相关品质检验.xlsx》第3步建;检验类别区分 首件检验/制程检验;报工审核可自动生成)",
  ];
  const missing = rows.filter((r) => !s.includes(r.split("   #")[0].trim()));
  if (missing.length) {
    // 插到第一条 qc_fin_spec 行之前
    const anchor = s.indexOf("table:qc_fin_spec_detail");
    if (anchor > 0) {
      s = s.slice(0, anchor) + missing.join("\n") + "\n" + s.slice(anchor);
    } else {
      if (!s.endsWith("\n")) s += "\n";
      s += missing.join("\n") + "\n";
    }
    fs.writeFileSync(INUSE, s, "utf8");
  }
  console.log("INUSE_ADDED=" + missing.length);
}

// 校验
const m = fs.readFileSync(MIG, "utf8");
const t = fs.readFileSync(INUSE, "utf8");
console.log("MIG_HAS_1=" + m.includes("migrate-qc-proc-insp.sql"));
console.log("MIG_HAS_2=" + m.includes("fix-qc-proc-insp-i18n.sql"));
console.log("INUSE_HAS_HEAD=" + t.includes("table:qc_proc_insp_head"));
console.log("INUSE_HAS_DETAIL=" + t.includes("table:qc_proc_insp_detail"));
console.log("INUSE_TOTAL=" + (t.match(/^table:/gm) || []).length);
