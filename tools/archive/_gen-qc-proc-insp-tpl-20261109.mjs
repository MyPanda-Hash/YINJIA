/**
 * _gen-qc-proc-insp-tpl-20261109.mjs — 由 .jrxml 生成「报表模板入库」迁移(避免手工转义 XML)。
 *
 * 背景(ADR-0002):报表模板解析 = **DB(yj_report_template) 优先 → classpath 注册表兜底**,
 * 且编译缓存按正文哈希失效 ⇒ **把新版式写进库里就立即生效,不必重启后端**。
 *
 * 本轮(2026-11-08 用户口径):面板「制程检验单」改名「出货检验单功能」,纸面/记录表标题改
 *   「出货检验记录表」⇒ classpath 的 qc_proc_insp.jrxml 里标题 staticText 已改名,
 *   库内同名行(yj_report_template.template_code='qc_proc_insp')必须同步改名/改正文,
 *   否则 PDF/Excel 导出仍印旧标题(库优先)。
 *
 * 与 2026-11-06 那条 `_gen-qc-proc-insp-tpl-20261106.mjs` 同款(那条只补「批准」签名格),
 * 本脚本只服务本轮改名:仓库 .jrxml 是部署源、库内行是运行源,**两者必须逐字节一致**(除行尾),
 * 所以从文件生成 SQL,别手抄。
 *
 * 用法:node tools/archive/_gen-qc-proc-insp-tpl-20261109.mjs
 *   读:backend/src/main/resources/reports/qc_proc_insp.jrxml
 *   写:tools/migrate-qc-proc-insp-tpl-20261109.sql
 *
 * ⚠ 与 2026-10-17 / 2026-11-06 两条迁移**同 template_code**:前两条已执行;本条是「再覆盖成最新版」,
 *   两账套均执行即可(MERGE 幂等)。
 */
import fs from 'node:fs'

const SRC = 'backend/src/main/resources/reports/qc_proc_insp.jrxml'
const OUT = 'tools/migrate-qc-proc-insp-tpl-20261109.sql'
const xmlRaw = fs.readFileSync(SRC, 'utf8')
if (!xmlRaw.includes('<jasperReport')) throw new Error('源文件不是 jrxml')
if (!xmlRaw.includes('"出货检验记录表"')) throw new Error('源文件标题未改成「出货检验记录表」')
if (xmlRaw.includes('制程检验记录表')) throw new Error('源文件仍含旧名「制程检验记录表」')
// 参考系统一成 **LF** 再入库:仓库里的 .jrxml 按 LF 存储(Git),DbSync.splitGo 执行时也会把
// 检出的 CRLF 重拼回 LF ⇒ 以 LF 为准生成;本 SQL 文件自己也就不会出现「半份 CRLF」的混合行尾。
const xml = xmlRaw.replace(/\r\n/g, '\n')
const quotes = (xml.match(/'/g) || []).length
// 去掉行尾后的字符数:**自检不能用原始 LEN(jrxml_text)** ——
//   DbSync.splitGo 会把 CRLF 重新拼成 LF 再执行,而 sqlcmd/SSMS 直跑本文件会保留 CRLF,
//   同一份 XML 的原始 LEN 会随「执行器 + 检出时的换行风格」漂移;去掉 CR/LF 后一劳永逸。
const charsNoEol = xml.replace(/[\r\n]/g, '').length
// T-SQL 单引号字面量:内部单引号要写成两个;本模板刻意不写撇号,真出现了也先转义再落库
const lit = xml.replace(/'/g, "''")
if (quotes !== 0) throw new Error(`源模板出现 ${quotes} 个单引号,请人工确认 T-SQL 转义`)

const sql = `/* migrate-qc-proc-insp-tpl-20261109.sql(2026-11-08):制程检验记录表报表模板 →「出货检验记录表」
 *
 * 用户口径(2026-11-08):面板「制程检验单」改名「出货检验单功能」,纸面/记录表标题改「出货检验记录表」
 *   ⇐ 报表模板里的标题 staticText 必须同步改(否则 PDF/Excel 导出仍印旧标题)。
 *   只改显示名:面板代号 QC_PROC_INSP / 表结构 / 单据编号前缀 ZC / 历史数据不动;
 *   2026-11-06 补的「批准」签名格(审批人参数 + $P{审批人})原样保留。
 *
 * 为什么连库也改:报表模板解析 = **DB(yj_report_template) 优先 → classpath 注册表兜底**(ADR-0002),
 *   编译缓存按正文哈希失效 ⇒ 写进库里**立即生效、不必重启后端**;仓库里的
 *   backend/src/main/resources/reports/qc_proc_insp.jrxml 是部署源,两者必须同源
 *   (本文件的 XML 由 tools/archive/_gen-qc-proc-insp-tpl-20261109.mjs 从该 .jrxml 生成,勿手改)。
 *
 * 幂等:MERGE on template_code;两账套均执行。源文件里单引号数 = ${quotes}(无需转义)。
 * ⚠ 与 migrate-qc-proc-insp-report-vertical-20261017.sql / migrate-qc-proc-insp-tpl-20261106.sql
 *   **同 template_code**(都已执行),本条把它们覆盖为「改名后的最新版」。
 *
 * 🔴 **INSERT 分支也必须写 update_at**:ReportService.compile() 的编译缓存以正文哈希 + update_at
 *   失效;库内模板行 update_at 为 NULL 时可能永远走缓存、改库也不生效(2026-10-17/11-06 两次踩坑)。
 *   两条分支都写 SYSDATETIME()。
 */

MERGE yj_report_template AS t
USING (VALUES (N'qc_proc_insp', N'QC_PROC_INSP', N'出货检验记录表', N'${lit}', N'纵向表版式(2026-10-17)+ 批准签名格(2026-11-06 两级审批)+ 改名出货检验记录表(2026-11-08)')) AS s(template_code, panel_code, name, jrxml_text, remark)
   ON t.template_code = s.template_code
WHEN MATCHED THEN UPDATE SET panel_code = s.panel_code, name = s.name, jrxml_text = s.jrxml_text,
     remark = s.remark, enabled = N'Y', update_by = N'migration', update_at = SYSDATETIME()
WHEN NOT MATCHED THEN INSERT (template_code, panel_code, name, jrxml_text, enabled, remark, create_by, update_by, update_at)
     VALUES (s.template_code, s.panel_code, s.name, s.jrxml_text, N'Y', s.remark, N'migration', N'migration', SYSDATETIME());
GO

/* 自检:模板名 = 出货检验记录表;库内 XML 与仓库文件同源(去行尾字符数 + 关键片段);
   旧标题不得残留;2026-11-06 的 审批人 参数/取值格保留;update_at 非空(否则编译缓存不失效)。
   ⚠ LEN 按「去掉 CR/LF 后的字符数」校验,避免 sqlcmd 直跑(CRLF)与 DbSync(LF)两种执行器得出两个数。 */
DECLARE @bad int = 0;
IF (SELECT COUNT(*) FROM yj_report_template WHERE template_code = N'qc_proc_insp') <> 1 SET @bad = @bad + 1;
IF (SELECT name FROM yj_report_template WHERE template_code = N'qc_proc_insp') <> N'出货检验记录表' SET @bad = @bad + 1;
IF (SELECT LEN(REPLACE(REPLACE(jrxml_text, NCHAR(13), N''), NCHAR(10), N'')) FROM yj_report_template WHERE template_code = N'qc_proc_insp') <> ${charsNoEol} SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_proc_insp') NOT LIKE N'%出货检验记录表%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_proc_insp') LIKE N'%制程检验记录表%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_proc_insp') NOT LIKE N'%检验人员%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_proc_insp') NOT LIKE N'%产线常规功能性结果%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_proc_insp') NOT LIKE N'%$P{审批人}%' SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_report_template WHERE template_code = N'qc_proc_insp' AND update_at IS NULL) <> 0 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'出货检验记录表模板迁移自检失败', 16, 1);
ELSE PRINT N'出货检验记录表模板已就绪(库内 = 仓库 .jrxml;旧标题 0 残留;审批人参数保留;update_at 非空)';
GO
`
fs.writeFileSync(OUT, sql, 'utf8')
console.log(`OK ${OUT}  (xml ${xml.length} 字符[LF], 去行尾 ${charsNoEol} 字符, 单引号 ${quotes} 处)`)
