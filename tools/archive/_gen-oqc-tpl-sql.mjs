/**
 * _gen-oqc-tpl-sql.mjs — 由 .jrxml 生成「出厂检验报告模板入库」迁移(避免手工转义 XML)。
 *
 * 背景(ADR-0002):报表模板解析 = **DB(yj_report_template) 优先 → classpath 注册表兜底**,
 * 且编译缓存按正文哈希 / update_at 失效 ⇒ **把新版式写进库里就立即生效,不必重启后端**。
 * 2026-11-04 这次出厂检验报告改版(去地址页脚 + 审核/批准按头字段落值)既要改仓库里的
 * backend/src/main/resources/reports/qc_oqc.jrxml(部署源),也要把同一份 XML 落库(运行源),
 * 两者必须逐字节一致 —— 所以用本脚本从文件生成 SQL,别手抄。
 *
 * 用法:node tools/archive/_gen-oqc-tpl-sql.mjs   (在仓库根目录执行)
 *   读:backend/src/main/resources/reports/qc_oqc.jrxml
 *   写:tools/migrate-oqc-report-tpl-20261104.sql
 */
import fs from 'node:fs'

const SRC = 'backend/src/main/resources/reports/qc_oqc.jrxml'
const OUT = 'tools/migrate-oqc-report-tpl-20261104.sql'
const raw = fs.readFileSync(SRC, 'utf8')
// 🔴 行尾归一:工作区里 .jrxml 是 CRLF(autocrlf 检出),但 DbSync.splitGo() 按 \r?\n 切批、
//    重新用 '\n' 拼回 ⇒ **经 DbSync 执行的脚本一律是 LF**,库里的 jrxml_text 也只会有 LF。
//    本机实测:不归一时 LEN 比文件长度少 440(正是 440 个 CR 被吃掉),自检会红。
//    所以生成器按 LF 归一后取长度、写文件(数据库实际内容 = 仓库 index 里的 LF 版本,与 .jrxml 同源;
//    jar 内的 classpath 版本是工作区 CRLF,编译/版式不受换行符影响)。
const xml = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
if (!xml.includes('<jasperReport')) throw new Error('源文件不是 jrxml: ' + SRC)

// 生成前先拦一刀:本次版式的关键点必须已经在 .jrxml 里,否则别生成(避免把旧版式落库)
const must = ['<parameter name="审核人"', '<parameter name="审批人"', '$P{审核人}', '$P{审批人}']
for (const s of must) {
  if (!xml.includes(s)) throw new Error('源 .jrxml 缺少 2026-11-04 版式的关键片段: ' + s)
}
const banned = ['water-agplus', '惠州大亚湾', '5583930']
for (const s of banned) {
  if (xml.includes(s)) throw new Error('源 .jrxml 仍含被删除的页脚地址内容: ' + s)
}

const quotes = (xml.match(/'/g) || []).length
// T-SQL 单引号字面量:内部单引号要写成两个;本模板的 4 个单引号都在注释里('yyyy-MM-dd'),
// 真出现别处也先转义再落库,DB 里存的是原文(转义只影响 SQL 词法)
const lit = xml.replace(/'/g, "''")
const chars = xml.length // UTF-16 码元数;模板全为 BMP 字符 ⇒ 与 SQL Server LEN(nvarchar) 相等

const sql = `/* migrate-oqc-report-tpl-20261104.sql(2026-11-04):出厂检验报告(QC_OQC_REPORT)**报表模板入库**。
 *
 * 任务来源:task-3「出厂检验报告报表:去页脚/签署落值 + 模板入库迁移(导出报表设定)」。
 * 用户 2026-11-04 口径:
 *   ① 报表模板 backend/src/main/resources/reports/qc_oqc.jrxml 去掉页脚里的公司地址/网址/邮箱/电话
 *      那一行(红框内容);
 *   ② 签署行 审核/批准 由静态下划线改为按头字段值落值(审核人=一级审批人,审批人=超级管理员/二级);
 *   ③ 把该模板「设定」进导出报表机制:写入 yj_report_template(DB 优先,模板管理可见),
 *      彻底避免「没设定时回落到通用错误格式」。
 *
 * 本 SQL 的 XML 正文由 tools/archive/_gen-oqc-tpl-sql.mjs 从
 *   backend/src/main/resources/reports/qc_oqc.jrxml
 * 逐字节生成(仅做 T-SQL 单引号转义),**勿手改本文件**;改版式请改 .jrxml 后重跑生成器。
 * 仓库 .jrxml 是部署源(新装/兜底),库内行是运行源(DB 优先,立即生效),两者必须同源。
 *
 * 幂等:MERGE on template_code(N'qc_oqc');两账套(HSDZ_MES / HSDZ_MES_TEST)均执行。
 * 源文件:${chars} 字符(LF 归一后),单引号 ${quotes} 处(已按 T-SQL 规则转义)。
 * 行尾:DbSync 按行切批再以 LF 重组 ⇒ 库内 jrxml_text 为 LF;本文件正文也按 LF 生成,
 *   自检 LEN 期望值 = ${chars}(若拿工作区 CRLF 检出后的文件长度比,会多出每行一个 CR —— 本机实测 +440)。
 *
 * 🔴 **INSERT 分支也必须写 update_at**(ADR-0002 踩坑记录,制程检验记录表改版时实测):
 *   ReportService.compile() 的编译缓存判据含 update_at;库里模板行 update_at 为 NULL 时,
 *   进程一旦编译过一次(哪怕编译的是 classpath 旧模板),此后改库不生效(实测导出字节都不变)。
 *   所以两条分支都写 SYSDATETIME(),让 update_at 非空、缓存按它/正文哈希失效。
 */

MERGE yj_report_template AS t
USING (VALUES (N'qc_oqc', N'QC_OQC_REPORT', N'出厂检验报告', N'${lit}',
              N'受控表单 c-95-12 / YJ-QR-05/A1;2026-11-04:无地址页脚、审核/批准落值'))
      AS s(template_code, panel_code, name, jrxml_text, remark)
   ON t.template_code = s.template_code
WHEN MATCHED THEN UPDATE SET panel_code = s.panel_code, name = s.name, jrxml_text = s.jrxml_text,
     remark = s.remark, enabled = N'Y', update_by = N'migration', update_at = SYSDATETIME()
WHEN NOT MATCHED THEN INSERT (template_code, panel_code, name, jrxml_text, enabled, remark, create_by, update_by, update_at)
     VALUES (s.template_code, s.panel_code, s.name, s.jrxml_text, N'Y', s.remark, N'migration', N'migration', SYSDATETIME());
GO

/* 自检(RAISERROR 16 ⇒ DbSync 判失败、不写 yj_schema_log):
   行数=1 / panel_code 正确 / LEN(jrxml_text)=源文件长度(库内与仓库同源)/
   含 审核人、审批人 两个参数片段 / **不含 water-agplus**(去页脚生效) / update_at 非空 / enabled=Y */
DECLARE @bad int = 0;
IF (SELECT COUNT(*) FROM yj_report_template WHERE template_code = N'qc_oqc') <> 1 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_report_template WHERE template_code = N'qc_oqc' AND panel_code <> N'QC_OQC_REPORT') SET @bad = @bad + 1;
IF (SELECT LEN(jrxml_text) FROM yj_report_template WHERE template_code = N'qc_oqc') <> ${chars} SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_oqc') NOT LIKE N'%<parameter name="审核人" class="java.lang.Object" isForPrompting="false"/>%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_oqc') NOT LIKE N'%<parameter name="审批人" class="java.lang.Object" isForPrompting="false"/>%' SET @bad = @bad + 1;
IF (SELECT jrxml_text FROM yj_report_template WHERE template_code = N'qc_oqc') LIKE N'%water-agplus%' SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_report_template WHERE template_code = N'qc_oqc' AND update_at IS NULL) <> 0 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_report_template WHERE template_code = N'qc_oqc' AND enabled <> N'Y') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'出厂检验报告模板入库自检失败(bad=%d)', 16, 1, @bad);
ELSE PRINT N'出厂检验报告模板已入库(库内 = 仓库 .jrxml;update_at 非空 ⇒ 编译缓存会失效)';
GO
`
fs.writeFileSync(OUT, sql, 'utf8')
console.log(`OK ${OUT}  (xml ${chars} 字符, 单引号 ${quotes} 处)`)
