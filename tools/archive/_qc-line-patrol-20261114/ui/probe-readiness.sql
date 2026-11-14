/* 巡线检验(QC_LINE_PATROL)落库体检:面板/字段/授权/两张物理表是否就绪(只读)
   用法(tools 下):java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" sa env ui/probe-readiness.sql */
SET NOCOUNT ON;

SELECT 'panel' AS obj, COUNT(*) AS cnt FROM yj_panel WHERE panel_code = 'QC_LINE_PATROL';

SELECT 'tables' AS obj, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN ('qc_line_patrol_head', 'qc_line_patrol_detail')
ORDER BY TABLE_NAME;

SELECT 'detail_cols' AS obj, COUNT(*) AS cnt
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'qc_line_patrol_detail';

SELECT 'head_cols' AS obj, COUNT(*) AS cnt
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'qc_line_patrol_head';

SELECT 'migration_log' AS obj, COUNT(*) AS cnt
FROM yj_schema_log WHERE script_name LIKE '%qc-line-patrol%';
