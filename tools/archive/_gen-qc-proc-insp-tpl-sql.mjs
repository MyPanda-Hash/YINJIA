/**
 * _gen-qc-proc-insp-tpl-sql.mjs — 由 .jrxml 生成「报表模板入库」迁移(避免手工转义 XML)。
 *
 * 背景(ADR-0002):报表模板解析 = **DB(yj_report_template) 优先 → classpath 注册表兜底**,
 * 且编译缓存按 update_at 失效 ⇒ **把新版式写进库里就立即生效,不必重启后端**。
 * 制程检验单这次改版(纵向表)既要改仓库里的 .jrxml(部署源),也要把同一份 XML 落库(运行源),
 * 两者必须逐字节一致 —— 所以用本脚本从文件生成 SQL,别手抄。
 *
 * 用法:node tools/archive/_gen-qc-proc-insp-tpl-sql.mjs
 *   读:backend/src/main/resources/reports/qc_proc_insp.jrxml
 *   写:tools/migrate-qc-proc-insp-report-vertical-20261017.sql
 */
import fs from 'node:fs'

const SRC = 'backend/src/main/resources/reports/qc_proc_insp.jrxml'
const OUT = 'tools/migrate-qc-proc-insp-report-vertical-20261017.sql'
const xml = fs.readFileSync(SRC, 'utf8')
if (!xml.includes('<jasperReport')) throw new Error('源文件不是 jrxml')
const quotes = (xml.match(/'/g) || []).length
// T-SQL 单引号字面量:内部单引号要写成两个;本模板刻意不写撇号,真出现了也先转义再落库
const lit = xml.replace(/'/g, "''")

const sql = `/* migrate-qc-proc-insp-report-vertical-20261017.sql(2026-10-17):制程检验记录表**报表模板改纵向表**。
 *
 * 用户口径:「当前这个报表形式需要根据当前页面修改实现导出,形成和当前页面导出形式相同的 excel 形式
 *   而不是当前的旧报表形式」—— 旧版式(外观/尺寸/出货重量 三组矩阵 + 尺寸_1..5/重量_1..5 定格参数)作废,
 *   报表与面板纸张表(QcProcInspSheet.vue)同一版式:抬头 → 表头两行(客户名称|产品编码|型号|批号|
 *   检验人员|产线常规功能性结果|结果判断 + 检验要求|检验方法)→ 一行一个检验项目 → 结论区。
 *
 * 为什么连库也改:报表模板解析 = **DB(yj_report_template) 优先 → classpath 注册表兜底**(ADR-0002),
 *   编译缓存按 update_at 失效 ⇒ 写进库里**立即生效、不必重启后端**;仓库里的
 *   backend/src/main/resources/reports/qc_proc_insp.jrxml 是部署源,两者必须同源
 *   (本文件的 XML 由 tools/archive/_gen-qc-proc-insp-tpl-sql.mjs 从该 .jrxml 生成,勿手改)。
 *
 * 幂等:MERGE on template_code;两账套均执行。源文件里单引号数 = ${quotes}(已按 T-SQL 规则转义)。
 *
 * 🔴 **INSERT 分支也必须写 update_at**(本迁移第一版漏了,踩坑记录):
 *   ReportService.compile() 的编译缓存判据是
 *     \`c != null && (tpl.updatedAt() == null || tpl.updatedAt().equals(c.updatedAt()))\` ⇒ 用缓存
 *   —— 库里的模板行若 update_at 为 NULL,进程一旦编译过一次(哪怕编译的是 classpath 旧模板),
 *   **此后永远走缓存、改库也不生效**(实测:改库后导出仍是旧版式,字节都不变)。
 *   所以两条分支都写 SYSDATETIME(),让 update_at 非空、缓存按它失效。
 */

MERGE yj_report_template AS t
USING (VALUES (N'qc_proc_insp', N'QC_PROC_INSP', N'制程检验记录表', N'${lit}', N'纵向表版式(2026-10-17):与面板纸张表同源;旧的三组矩阵版式作废')) AS s(template_code, panel_code, name, jrxml_text, remark)
   ON t.template_code = s.template_code
WHEN MATCHED THEN UPDATE SET panel_code = s.panel_code, name = s.name, jrxml_text = s.jrxml_text,
     remark = s.remark, enabled = N'Y', update_by = N'migration', update_at = SYSDATETIME()
WHEN NOT MATCHED THEN INSERT (template_code, panel_code, name, jrxml_text, enabled, remark, create_by, update_by, update_at)
     VALUES (s.template_code, s.panel_code, s.name, s.jrxml_text, N'Y', s.remark, N'migration', N'migration', SYSDATETIME());
GO

/* 自检:库内 XML 与仓库文件同源(长度 + 关键片段)+ update_at 必须非空(否则编译缓存永不失效) */
DECLARE @bad int = 0;
IF (SELECT COUNT(*) FROM yj_report_template WHERE template_code = N'qc_proc_insp') <> 1 SET @bad = @bad + 1;
IF (SELECT LEN(jrxml_text) FROM yj_report_template WHERE template_code = N'qc_proc_insp') <> ${xml.length} SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_proc_insp') NOT LIKE N'%检验人员%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_proc_insp') NOT LIKE N'%产线常规功能性结果%' SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_report_template WHERE template_code = N'qc_proc_insp' AND update_at IS NULL) <> 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验记录表模板迁移自检失败', 16, 1);
ELSE PRINT N'制程检验记录表模板已更新为纵向表版式(库内 = 仓库 .jrxml;update_at 非空 ⇒ 编译缓存会失效)';
GO
`
fs.writeFileSync(OUT, sql, 'utf8')
console.log(`OK ${OUT}  (xml ${xml.length} 字符, 单引号 ${quotes} 处)`)
