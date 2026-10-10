-- _health-probe-1.sql  只读探针:库名 / yj_schema_log 状态 / 相关表字段名
SELECT DB_NAME() AS db_name,
       CASE WHEN OBJECT_ID('yj_schema_log') IS NULL THEN N'缺失' ELSE N'存在' END AS schema_log;
GO
IF OBJECT_ID('yj_schema_log') IS NOT NULL EXEC(N'SELECT COUNT(*) AS schema_log_rows FROM yj_schema_log');
ELSE SELECT N'yj_schema_log 不存在' AS schema_log_rows;
GO
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('scjl','qc_mold_insp_head','qc_cut_insp_head','qc_asm_insp_head')
  AND (COLUMN_NAME LIKE N'%报工%' OR COLUMN_NAME LIKE N'%工单%' OR COLUMN_NAME LIKE N'%批次%'
       OR COLUMN_NAME LIKE N'%单据%' OR COLUMN_NAME LIKE N'%单号%' OR COLUMN_NAME LIKE N'%cancel%'
       OR COLUMN_NAME LIKE N'%cancel%' OR COLUMN_NAME = 'id')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
GO
SELECT TABLE_NAME, COUNT(*) AS col_count
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('scjl','qc_mold_insp_head','qc_cut_insp_head','qc_asm_insp_head')
GROUP BY TABLE_NAME ORDER BY TABLE_NAME;
