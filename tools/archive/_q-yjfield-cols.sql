-- 临时探针:yj_field 列清单(找默认值/别名类列,供「来料检验 默认否」落位)+ 迁移清单位置
SET NOCOUNT ON;
SELECT c.name AS 列名, t.name AS 类型, c.max_length / 2 AS 字符数
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.yj_field') ORDER BY c.column_id;

SELECT COUNT(*) AS INV字段行数 FROM yj_field WHERE panel_code = N'INV';
