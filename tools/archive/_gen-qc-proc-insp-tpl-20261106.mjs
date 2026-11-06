/**
 * _gen-qc-proc-insp-tpl-20261106.mjs — 由 .jrxml 生成「报表模板入库」迁移(避免手工转义 XML)。
 *
 * 背景(ADR-0002):报表模板解析 = **DB(yj_report_template) 优先 → classpath 注册表兜底**,
 * 且编译缓存按正文哈希失效 ⇒ **把新版式写进库里就立即生效,不必重启后端**。
 *
 * 本脚本 = 2026-10-17 版 `tools/archive/_gen-qc-proc-insp-tpl-sql.mjs` 的同款复制
 * (**原脚本与原迁移 tools/migrate-qc-proc-insp-report-vertical-20261017.sql 保持不动**),
 * 只服务 2026-11-06 这一轮:QC_PROC_INSP / QC_FIRST_INSP 由「管理员直接审核」改为**两级审批**
 * (提交审批 → 一级审批 → 超级管理员批准),页脚签署区「批准：」原来只有 staticText 标签、
 * **没有对应取值格**(实测导出的 PDF 上「批准：」后面永远空白)⇒ .jrxml 补 `审批人` 参数
 * 与 `$P{审批人}` 取值格。
 * 仓库 .jrxml 是部署源、库内行是运行源,**两者必须逐字节一致** —— 所以从文件生成 SQL,别手抄。
 *
 * 用法:node tools/archive/_gen-qc-proc-insp-tpl-20261106.mjs
 *   读:backend/src/main/resources/reports/qc_proc_insp.jrxml
 *   写:tools/migrate-qc-proc-insp-tpl-20261106.sql
 *
 * ⚠ 与 2026-10-17 那条迁移**同 template_code**:那条已执行过;本迁移是「再覆盖成最新版」,
 *   两账套均执行即可(MERGE 幂等)。
 */
import fs from 'node:fs'

const SRC = 'backend/src/main/resources/reports/qc_proc_insp.jrxml'
const OUT = 'tools/migrate-qc-proc-insp-tpl-20261106.sql'
const xmlRaw = fs.readFileSync(SRC, 'utf8')
if (!xmlRaw.includes('<jasperReport')) throw new Error('源文件不是 jrxml')
// 参考系统一成 **LF** 再入库:仓库里的 .jrxml 按 LF 存储(Git),DbSync.splitGo 执行时也会把
// 检出的 CRLF 重拼回 LF ⇒ 以 LF 为准生成;本 SQL 文件自己也就不会出现「半份 CRLF」的混合行尾。
const xml = xmlRaw.replace(/\r\n/g, '\n')
const quotes = (xml.match(/'/g) || []).length
// 去掉行尾后的字符数:**自检不能用原始 LEN(jrxml_text)** ——
//   DbSync.splitGo 会把 CRLF 重新拼成 LF 再执行,而 sqlcmd/SSMS 直跑本文件会保留 CRLF,
//   同一份 XML 的原始 LEN 会随「执行器 + 检出时的换行风格」漂移(2026-10-17 那条迁移按 LF
//   长度 16973 自检,就是从这种耦合里来的)。去掉 CR/LF 后两种执行器算出来一致,自检才稳。
const charsNoEol = xml.replace(/[\r\n]/g, '').length
// T-SQL 单引号字面量:内部单引号要写成两个;本模板刻意不写撇号,真出现了也先转义再落库
const lit = xml.replace(/'/g, "''")

const sql = `/* migrate-qc-proc-insp-tpl-20261106.sql(2026-11-06):制程检验记录表报表模板**补「批准」签名格**。
 *
 * 用户口径(2026-11-06 需求 3):首件检验单(QC_FIRST_INSP)/ 制程检验单(QC_PROC_INSP)
 *   由「管理员直接审核」改为**两级审批**(提交审批 → 一级审批 → 超级管理员批准)
 *   ⇒ 纸面页脚签署区必须能印出「批准 = 超级管理员」。
 *   本模板原「批准：」只有 staticText 标签、**没有对应取值格** —— 实测导出的 PDF 上
 *   「批准：」后面永远空白;本次补 <parameter name="审批人"> + $P{审批人} 的 textField。
 *
 * 为什么连库也改:报表模板解析 = **DB(yj_report_template) 优先 → classpath 注册表兜底**(ADR-0002),
 *   编译缓存按正文哈希失效 ⇒ 写进库里**立即生效、不必重启后端**;仓库里的
 *   backend/src/main/resources/reports/qc_proc_insp.jrxml 是部署源,两者必须同源
 *   (本文件的 XML 由 tools/archive/_gen-qc-proc-insp-tpl-20261106.mjs 从该 .jrxml 生成,勿手改)。
 *
 * 幂等:MERGE on template_code;两账套均执行。源文件里单引号数 = ${quotes}(已按 T-SQL 规则转义)。
 * ⚠ 与 tools/migrate-qc-proc-insp-report-vertical-20261017.sql **同 template_code**(那条已执行),
 *   本迁移把库内行覆盖为「纵向表版式 + 批准签名格」最新版。
 *
 * 🔴 **INSERT 分支也必须写 update_at**(2026-10-17 踩坑,原样保留):
 *   ReportService.compile() 的编译缓存判据(旧版看 update_at,现以正文哈希为主)——
 *   库里的模板行若 update_at 为 NULL,进程一旦编译过一次(哪怕编译的是 classpath 旧模板),
 *   会走缓存、改库也不生效(实测:改库后导出仍是旧版式,字节都不变)。
 *   所以两条分支都写 SYSDATETIME(),让 update_at 非空、缓存按它失效。
 */

MERGE yj_report_template AS t
USING (VALUES (N'qc_proc_insp', N'QC_PROC_INSP', N'制程检验记录表', N'${lit}', N'纵向表版式(2026-10-17)+ 批准签名格(2026-11-06 两级审批:批准=超级管理员)')) AS s(template_code, panel_code, name, jrxml_text, remark)
   ON t.template_code = s.template_code
WHEN MATCHED THEN UPDATE SET panel_code = s.panel_code, name = s.name, jrxml_text = s.jrxml_text,
     remark = s.remark, enabled = N'Y', update_by = N'migration', update_at = SYSDATETIME()
WHEN NOT MATCHED THEN INSERT (template_code, panel_code, name, jrxml_text, enabled, remark, create_by, update_by, update_at)
     VALUES (s.template_code, s.panel_code, s.name, s.jrxml_text, N'Y', s.remark, N'migration', N'migration', SYSDATETIME());
GO

/* 自检:库内 XML 与仓库文件同源(去行尾后的字符数 + 关键片段,含 2026-11-06 新增的 审批人 / $P{审批人})+
   update_at 必须非空(否则编译缓存不失效)。
   ⚠ 长度按「去掉 CR/LF 后的字符数」校验,而不是原始 LEN(jrxml_text):
     DbSync.splitGo 会把 CRLF 重新拼成 LF 再执行;**sqlcmd / SSMS 直跑本文件却保留 CRLF**
     ⇒ 原始 LEN 随「执行器 + 检出时的换行风格」漂移,同一份 XML 会算出两个数。
     (2026-10-17 那条迁移的自检就写死了 LF 长度 16973:经 DbSync 能过,从 CRLF 检出用 sqlcmd
     直跑就会误报「自检失败」。)去掉 CR/LF 后两种执行器一致。 */
DECLARE @bad int = 0;
IF (SELECT COUNT(*) FROM yj_report_template WHERE template_code = N'qc_proc_insp') <> 1 SET @bad = @bad + 1;
IF (SELECT LEN(REPLACE(REPLACE(jrxml_text, NCHAR(13), N''), NCHAR(10), N'')) FROM yj_report_template WHERE template_code = N'qc_proc_insp') <> ${charsNoEol} SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_proc_insp') NOT LIKE N'%检验人员%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_proc_insp') NOT LIKE N'%产线常规功能性结果%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_proc_insp') NOT LIKE N'%审批人%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_proc_insp') NOT LIKE N'%$P{审批人}%' SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_report_template WHERE template_code = N'qc_proc_insp' AND update_at IS NULL) <> 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'制程检验记录表模板迁移自检失败', 16, 1);
ELSE PRINT N'制程检验记录表模板已补「批准」签名格(库内 = 仓库 .jrxml;审批人参数 + $P{审批人};update_at 非空 ⇒ 编译缓存会失效)';
GO
`
fs.writeFileSync(OUT, sql, 'utf8')
console.log(`OK ${OUT}  (xml ${xml.length} 字符[LF], 去行尾 ${charsNoEol} 字符, 单引号 ${quotes} 处)`)
