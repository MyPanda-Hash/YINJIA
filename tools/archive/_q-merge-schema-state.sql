-- _q-merge-schema-state.sql — 合并后:两账套迁移登记现状(只读)
SET NOCOUNT ON;
PRINT '=== 相关脚本登记情况(未列出=未执行) ===';
SELECT script_name, applied_at FROM yj_schema_log
WHERE script_name IN (N'migrate-lab-sheets-date-fields-2026-10-07.sql', N'migrate-server-converge-20261007.sql',
                      N'migrate-server-comment-parity3-20261007.sql', N'migrate-wo-process-line-qty-recalc.sql',
                      N'migrate-line-load-on-plang.sql')
ORDER BY script_name;
PRINT '=== 登记总数 / 最近 3 条 ===';
SELECT COUNT(*) AS 登记条数 FROM yj_schema_log;
SELECT TOP 3 script_name, applied_at FROM yj_schema_log ORDER BY applied_at DESC;
