-- r-06:yj_panel 表结构 + 是否另有按钮配置来源
SET NOCOUNT ON;
GO
PRINT '=== [1] yj_panel 列结构 ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('yj_panel') ORDER BY c.column_id;
GO
PRINT '=== [2] 全部 yj_ 前缀表 ===';
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE 'yj[_]%' ORDER BY TABLE_NAME;
GO
PRINT '=== [3] yj_attachment 列结构 ===';
IF OBJECT_ID('yj_attachment') IS NOT NULL
  SELECT c.column_id, c.name, t.name AS type, c.max_length, c.is_nullable
  FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID('yj_attachment') ORDER BY c.column_id;
GO
PRINT '=== [4] yj_attachment 行数 + 按面板分布 ===';
IF OBJECT_ID('yj_attachment') IS NOT NULL
  SELECT COUNT(*) AS total FROM yj_attachment;
GO
