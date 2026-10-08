SET NOCOUNT ON;
SELECT TOP 12 * FROM yj_std_lib ORDER BY lib_code, seq;
SELECT lib_code AS 库编码, COUNT(*) AS 条目数 FROM yj_std_lib GROUP BY lib_code;
SELECT panel_code AS 面板, label AS 字段, data_type AS 类型, dict_sql AS 库编码 FROM yj_field WHERE data_type=N'标准库';
GO