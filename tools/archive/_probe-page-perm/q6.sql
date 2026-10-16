SET NOCOUNT ON;
PRINT '=== 探针残留检查(两个都应返回 0)==='; 
SELECT (SELECT COUNT(*) FROM yj_role WHERE role_code = N'PAGE_PERM_PROBE') AS 残留角色,
       (SELECT COUNT(*) FROM yj_user WHERE username = N'pageperm_probe') AS 残留账号;

PRINT '=== 测试账套四个页面面板授权(应仍有历史角色)===';
SELECT r.id AS 角色ID, r.role_name AS 角色, rp.panel_code AS 面板码, rp.perms AS 权限词
FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
WHERE rp.panel_code IN (N'ORDER_CONVERT', N'SCHEDULE_BOARD', N'WORK_ORDER_BOARD', N'WORK_ORDER_LIST')
ORDER BY rp.panel_code, r.id;

PRINT '=== 正式账套角色总数(应与改造前一致:8 个:1,2,1009,1014,1015,1025,1026 + 无)===';
SELECT COUNT(*) AS 角色总数 FROM yj_role;
SELECT id, role_code, role_name FROM yj_role ORDER BY id;
