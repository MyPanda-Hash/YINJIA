-- q-06-schemalog-today.sql — 今天(2026-10-15)登记过的脚本 = 本次拉取同步实际执行过的脚本
SET NOCOUNT ON;
SELECT script_name, applied_at FROM yj_schema_log WHERE applied_at >= '2026-10-15' ORDER BY applied_at;
GO
SELECT N'四单相关登记(最近 12)' AS k, script_name, applied_at FROM yj_schema_log
WHERE script_name LIKE '%fourdoc%' OR script_name LIKE '%doc-field%' OR script_name LIKE '%qcrecv%'
   OR script_name LIKE '%pur-in%' OR script_name LIKE '%purchase-in%' OR script_name LIKE '%qc-%'
ORDER BY applied_at DESC;
GO
