#!/usr/bin/env node
/**
 * ⛔ 2026-10-14 起**不再使用**(保留作历史记录 / 应急):
 *   当时是为了在「8090 不能重启」的前提下让模板立即生效才写 DB。
 *   现在既定口径已回到 **classpath 注册表**(report-templates.properties + reports/*.jrxml),
 *   两账套的 yj_report_template 里 qc_proc_insp 行**已删除**。
 *   ⚠ 再跑本脚本会写回一条 DB 行,而 **DB 优先于注册表** ⇒ 会用这份快照**遮蔽**注册表里
 *     更新过的模板(jrxml 改了却看不到效果,正是最难查的那类问题)。改用 `mvn package` + 重启。
 *   ⚠ 另有坑:本脚本一次性 fs.writeFileSync 写大段含中文的 SQL,在受限沙箱下会被截断成
 *      0 字节(实测 2026-10-14);若确需再造 SQL,请分块 append 写入并校验文件长度。
 *
 * 原用途:把制程检验记录表模板写入 yj_report_template(DB 存储 = 上传即生效,免重启)。
 * 见 ADR-0002:模板可放 classpath 注册表,也可放 DB;DB 优先、按 update_at 失效重编。
 * 运行: node tools/archive/_qc-proc/seed-db-template.mjs
 */
import fs from "node:fs";

const TPL = "D:\\workspace\\yinjia\\backend\\src\\main\\resources\\reports\\qc_proc_insp.jrxml";
const text = fs.readFileSync(TPL, "utf8");

if (!text.includes("<jasperReport")) {
  console.error("模板缺 <jasperReport> 根元素");
  process.exit(1);
}
console.log("模板长度=" + text.length + " 含根元素=OK");

// 生成 SQL(用 N'' 转义单引号)
const esc = text.replace(/'/g, "''");
const sql = `SET NOCOUNT ON;
MERGE yj_report_template AS t USING (VALUES (N'qc_proc_insp', N'QC_PROC_INSP', N'制程检验记录表',
  N'${esc}', N'按《生产相关品质检验.xlsx》制程检验页签版式(2026-10-12)', N'admin'))
  AS s(template_code, panel_code, name, jrxml_text, remark, update_by)
ON t.template_code = s.template_code
WHEN MATCHED THEN UPDATE SET panel_code=s.panel_code, name=s.name, jrxml_text=s.jrxml_text,
  enabled='Y', remark=s.remark, update_by=s.update_by, update_at=SYSDATETIME()
WHEN NOT MATCHED THEN INSERT (template_code, panel_code, name, jrxml_text, enabled, remark, create_by, update_by)
  VALUES (s.template_code, s.panel_code, s.name, s.jrxml_text, 'Y', s.remark, s.update_by, s.update_by);
SELECT template_code, panel_code, name, LEN(jrxml_text) AS jrxml长度, enabled FROM yj_report_template WHERE template_code='qc_proc_insp';
`;
fs.writeFileSync("D:\\workspace\\yinjia\\tools\\archive\\_qc-proc\\_seed-tpl.sql", sql, "utf8");
console.log("已生成 _seed-tpl.sql (" + sql.length + " 字节)");
