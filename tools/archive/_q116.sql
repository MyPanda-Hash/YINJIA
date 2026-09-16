SET NOCOUNT ON;
-- 触发器
SELECT name, type_desc FROM sys.triggers WHERE parent_id = OBJECT_ID('dbo.kucun');
-- 计算列
SELECT name, is_computed, definition FROM sys.computed_columns WHERE object_id = OBJECT_ID('dbo.kucun');
-- 所有列的详细定义
SELECT c.name, t.name AS type, c.max_length, c.is_nullable FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.kucun') ORDER BY c.column_id;
-- 默认值约束
SELECT c.name, dc.definition FROM sys.columns c JOIN sys.default_constraints dc ON c.default_object_id=dc.object_id WHERE c.object_id=OBJECT_ID('dbo.kucun');
