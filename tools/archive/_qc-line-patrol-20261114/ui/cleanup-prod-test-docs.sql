/* 巡线检验(QC_LINE_PATROL)前端自测产生的**正式库测试单**清理(2026-11-14)
   目标库:HSDZ_MES(正式库)。只删本任务 ego 走查造的两张单,别的单一行不动。
   清理链口径照 tools/archive/_inv-proc-insp-20261114/cleanup-manual.sql 与
   tools/archive/_first-insp-daily-20261112/_cleanup.sql:
   明细 → 头 → yj_doc_status → form_flow_link(占用链)→ yj_usage_log → yj_attachment。
   号池 s_allno 不回退(Lead 口径)。末尾自检全部应为 0。
   用法(tools 下):
     java -Dstdout.encoding=UTF-8 -Dfile.encoding=UTF-8 -cp lib\mssql-jdbc.jar \
       SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env \
       archive/_qc-line-patrol-20261114/ui/cleanup-prod-test-docs.sql
   ⚠ -Dfile.encoding=UTF-8 必须带:本脚本含中文列名,控制台/文件编码错位会把中文列名吞成乱码。 */
SET NOCOUNT ON;

DECLARE @nos TABLE (no nvarchar(100) PRIMARY KEY);
-- XJ-2026-11-0001/0002 = 首轮 ego 走查造的单;XJ-2026-11-0003 = 第二轮误登正式库时又造的一张
-- (登录工厂没切到 YJ_TEST),一并清掉。脚本幂等:已清干净再跑就是 0 行。
INSERT INTO @nos (no) VALUES (N'XJ-2026-11-0001'), (N'XJ-2026-11-0002'), (N'XJ-2026-11-0003');

PRINT N'== 清理前:这两张单在各表的行数 ==';
SELECT (SELECT COUNT(*) FROM dbo.qc_line_patrol_detail WHERE 单据编号 IN (SELECT no FROM @nos)) AS detail_before,
       (SELECT COUNT(*) FROM dbo.qc_line_patrol_head   WHERE 单据编号 IN (SELECT no FROM @nos)) AS head_before,
       (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE panel_code = N'QC_LINE_PATROL' AND doc_no IN (SELECT no FROM @nos)) AS docstatus_before,
       (SELECT COUNT(*) FROM dbo.form_flow_link WHERE target_form_no IN (SELECT no FROM @nos) OR source_form_no IN (SELECT no FROM @nos)) AS flowlink_before,
       (SELECT COUNT(*) FROM dbo.yj_usage_log WHERE doc_no IN (SELECT no FROM @nos)) AS usagelog_before,
       (SELECT COUNT(*) FROM dbo.yj_attachment WHERE doc_no IN (SELECT no FROM @nos)) AS attach_before;

DELETE FROM dbo.qc_line_patrol_detail WHERE 单据编号 IN (SELECT no FROM @nos);
PRINT N'  detail 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.qc_line_patrol_head WHERE 单据编号 IN (SELECT no FROM @nos);
PRINT N'  head 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.yj_doc_status WHERE panel_code = N'QC_LINE_PATROL' AND doc_no IN (SELECT no FROM @nos);
PRINT N'  yj_doc_status 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.form_flow_link WHERE target_form_no IN (SELECT no FROM @nos) OR source_form_no IN (SELECT no FROM @nos);
PRINT N'  form_flow_link 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.yj_usage_log WHERE doc_no IN (SELECT no FROM @nos);
PRINT N'  yj_usage_log 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));
DELETE FROM dbo.yj_attachment WHERE doc_no IN (SELECT no FROM @nos);
PRINT N'  yj_attachment 已删: ' + CAST(@@ROWCOUNT AS nvarchar(10));

PRINT N'== 清理后自检(全部应为 0) ==';
SELECT (SELECT COUNT(*) FROM dbo.qc_line_patrol_detail WHERE 单据编号 IN (SELECT no FROM @nos)) AS detail_left,
       (SELECT COUNT(*) FROM dbo.qc_line_patrol_head   WHERE 单据编号 IN (SELECT no FROM @nos)) AS head_left,
       (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE panel_code = N'QC_LINE_PATROL' AND doc_no IN (SELECT no FROM @nos)) AS docstatus_left,
       (SELECT COUNT(*) FROM dbo.form_flow_link WHERE target_form_no IN (SELECT no FROM @nos) OR source_form_no IN (SELECT no FROM @nos)) AS flowlink_left,
       (SELECT COUNT(*) FROM dbo.yj_usage_log WHERE doc_no IN (SELECT no FROM @nos)) AS usagelog_left,
       (SELECT COUNT(*) FROM dbo.yj_attachment WHERE doc_no IN (SELECT no FROM @nos)) AS attach_left;

PRINT N'== 全表清零自检(本任务只在正式库造过这 2 张;应全为 0) ==';
SELECT (SELECT COUNT(*) FROM dbo.qc_line_patrol_head) AS head_total,
       (SELECT COUNT(*) FROM dbo.qc_line_patrol_detail) AS detail_total,
       (SELECT COUNT(*) FROM dbo.yj_doc_status WHERE panel_code = N'QC_LINE_PATROL') AS docstatus_total;
