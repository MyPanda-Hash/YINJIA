SET NOCOUNT ON;
PRINT N'库 = ' + DB_NAME();
PRINT N'-- yj_field 最新 15 行(今天这些脚本灌的应在这里)';
SELECT TOP 15 id, panel_code AS 面板, label AS 标签 FROM yj_field ORDER BY id DESC;
PRINT N'-- id 分布:孤儿行区间 11845~12032 之上还有多少行(判断孤儿是不是今天灌的)';
SELECT (SELECT COUNT(*) FROM yj_field WHERE id > 12032) AS 孤儿区间之上行数,
       (SELECT COUNT(*) FROM yj_field) AS 总行数,
       (SELECT MAX(id) FROM yj_field) AS 最大id;
PRINT N'-- 孤儿行里各面板的 id 明细(看是不是一批连续 id)';
SELECT panel_code AS 面板, MIN(id) AS 最小id, MAX(id) AS 最大id, COUNT(*) AS 行数
  FROM yj_field f WHERE NOT EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = f.panel_code)
 GROUP BY panel_code ORDER BY MIN(id);
