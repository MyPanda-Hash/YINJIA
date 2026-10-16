SET NOCOUNT ON;
PRINT '=== ① yj_role_panel 的约束/外键 ===';
SELECT fk.name AS 外键, OBJECT_NAME(fk.parent_object_id) AS 表, COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS 列,
       OBJECT_NAME(fk.referenced_object_id) AS 引用表, COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS 引用列
FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
WHERE fk.parent_object_id = OBJECT_ID(N'dbo.yj_role_panel') OR fk.referenced_object_id = OBJECT_ID(N'dbo.yj_role_panel');

PRINT '=== ② yj_role_panel 现有面板码全清单(含虚拟面板 DASHBOARD?) ===';
SELECT DISTINCT panel_code FROM yj_role_panel ORDER BY panel_code;

PRINT '=== ③ 角色-面板授权行数按角色 ===';
SELECT r.id AS 角色ID, r.role_name AS 角色, COUNT(*) AS 授权面板数
FROM yj_role r LEFT JOIN yj_role_panel rp ON rp.role_id = r.id GROUP BY r.id, r.role_name ORDER BY r.id;

PRINT '=== ④ yj_panel 中 flat 型(报表类)面板样例——虚拟面板参照系 ===';
SELECT TOP 8 panel_code, panel_name, mode, head_table, line_table FROM yj_panel WHERE mode = 'flat' ORDER BY panel_code;
