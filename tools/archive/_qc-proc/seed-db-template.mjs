#!/usr/bin/env node
/**
 * 把制程检验记录表模板写入 yj_report_template(DB 存储 = 上传即生效,免重启)。
 * 见 ADR-0002:模板可放 classpath 注册表,也可放 DB;DB 优先、按 update_at 失效重编。
 * 写入后 8090 上的旧实例即可导出(模板文本走 DB,不受 jar 影响)。
 * ⚠ 但 ReportService 的「表区归并 + 5 格拆分」是 Java 代码,旧实例没有 ——
 *   旧实例导出时这三个参数会是 null,模板里 isBlankWhenNull 会显示空白。
 *   完整效果需重启 8090 加载新代码(见汇报说明)。
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
