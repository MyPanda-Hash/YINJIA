SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
PRINT N'-- 孤儿行的 panel_code 是否有尾空格(列类型/LEN/DATALENGTH 三看)';
SELECT panel_code AS 原值, LEN(panel_code) AS LEN值, DATALENGTH(panel_code) AS 字节数,
       '[' + panel_code + ']' AS 加括号看, COUNT(*) AS 行数
  FROM yj_field f
 WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code)
 GROUP BY panel_code ORDER BY panel_code;
PRINT N'-- yj_field.panel_code 列类型';
SELECT c.name AS 列, t.name AS 类型, c.max_length AS 长度 FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.yj_field') AND c.name IN (N'panel_code', N'col_name', N'label');
PRINT N'-- 对照:同一批面板里“被正确删掉”的 panel_code 形态(OTHER_IN)';
SELECT panel_code AS 原值, LEN(panel_code) AS LEN值, '[' + panel_code + ']' AS 加括号看, COUNT(*) AS 行数
  FROM yj_field WHERE panel_code LIKE N'OTHER_IN%' OR panel_code LIKE N'OTHER_OUT%'
 GROUP BY panel_code ORDER BY panel_code;
PRINT N'-- 尾空格行在 yj_field 全局有多少';
SELECT COUNT(*) AS 带尾空格的面板码行数 FROM yj_field WHERE panel_code <> RTRIM(panel_code);
