SET NOCOUNT ON;
PRINT '=== yj_role_panel 结构 ===';
SELECT c.column_id AS 序, c.name AS 列, t.name AS 类型, c.max_length AS 长度, c.is_nullable AS 可空,
       CASE WHEN c.is_identity = 1 THEN N'自增' ELSE N'' END AS 自增
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.yj_role_panel') ORDER BY c.column_id;

PRINT '=== yj_role_panel 索引/约束 ===';
SELECT i.name AS 索引, i.is_unique AS 唯一, i.is_primary_key AS 主键, c.name AS 列
FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID(N'dbo.yj_role_panel') ORDER BY i.index_id, ic.key_ordinal;

PRINT '=== 角色 2(普通用户)现有 perms 样例(前 6 行) ===';
SELECT TOP 6 role_id, panel_code, perms, can_approve FROM yj_role_panel WHERE role_id = 2 ORDER BY panel_code;
