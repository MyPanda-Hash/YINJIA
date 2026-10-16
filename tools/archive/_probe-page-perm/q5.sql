SET NOCOUNT ON;
PRINT '=== 四个页面面板的授权明细 ===';
SELECT r.id AS 角色ID, r.role_name AS 角色, r.is_admin AS 管理员, rp.panel_code AS 面板码, rp.perms AS 权限词, rp.can_approve AS 可审批
FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
WHERE rp.panel_code IN (N'ORDER_CONVERT', N'SCHEDULE_BOARD', N'WORK_ORDER_BOARD', N'WORK_ORDER_LIST')
ORDER BY rp.panel_code, r.id;

PRINT '=== 反向核对:有 MANU_ORDER 可见但没有新码的角色(应为空) ===';
SELECT r.id, r.role_name FROM yj_role r
WHERE EXISTS (SELECT 1 FROM yj_role_panel s WHERE s.role_id=r.id AND s.panel_code=N'MANU_ORDER' AND s.perms LIKE '%view%')
  AND NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id=r.id AND x.panel_code=N'WORK_ORDER_LIST');

PRINT '=== 有 SO_ORDER 可见但没有 ORDER_CONVERT 的角色(应为空) ===';
SELECT r.id, r.role_name FROM yj_role r
WHERE EXISTS (SELECT 1 FROM yj_role_panel s WHERE s.role_id=r.id AND s.panel_code=N'SO_ORDER' AND s.perms LIKE '%view%')
  AND NOT EXISTS (SELECT 1 FROM yj_role_panel x WHERE x.role_id=r.id AND x.panel_code=N'ORDER_CONVERT');

PRINT '=== 面板译名 ===';
SELECT scope, ref_key, locale, text, source FROM yj_translation
WHERE scope='panel' AND ref_key IN (N'订单结转', N'快速排产', N'工单排产', N'生产工单') ORDER BY ref_key, locale;
