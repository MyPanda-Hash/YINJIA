SET NOCOUNT ON;
PRINT '=== ① yj_panel 列 ===';
SELECT c.name, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'dbo.yj_panel') ORDER BY c.column_id;

PRINT '=== ② 相关面板行(全列) ===';
SELECT * FROM yj_panel
WHERE panel_code IN (N'MANU_ORDER', N'SO_ORDER', N'MANU_SCHEDULE', N'WO_ORDER')
   OR panel_name LIKE N'%订单结转%' OR panel_name LIKE N'%排产%' OR panel_name LIKE N'%生产订单%';

PRINT '=== ③ 四个候选码是否存在 ===';
SELECT code, CASE WHEN EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = v.code) THEN N'存在' ELSE N'不存在' END AS 状态
FROM (VALUES (N'ORDER_CONVERT'), (N'SCHEDULE_BOARD'), (N'WORK_ORDER_BOARD'), (N'MANU_ORDER')) v(code);

PRINT '=== ④ 角色清单 ===';
SELECT id, role_code, role_name, is_admin FROM yj_role ORDER BY id;

PRINT '=== ⑤ 授权行数 ===';
SELECT panel_code, COUNT(*) AS 角色数 FROM yj_role_panel
WHERE panel_code IN (N'MANU_ORDER', N'SO_ORDER', N'ORDER_CONVERT', N'SCHEDULE_BOARD', N'WORK_ORDER_BOARD')
GROUP BY panel_code ORDER BY panel_code;

PRINT '=== ⑥ 用户与角色 ===';
SELECT u.id, u.username, u.real_name, u.is_admin, u.role_id, r.role_name
FROM yj_user u LEFT JOIN yj_role r ON r.id = u.role_id ORDER BY u.id;
