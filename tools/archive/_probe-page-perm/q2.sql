SET NOCOUNT ON;
PRINT '=== ① 相关面板行 ===';
SELECT panel_code AS 面板码, panel_name AS 面板名, category AS 分类, mode AS 模式, module_group AS 模块组, panel_name_en AS 英文名
FROM yj_panel
WHERE panel_code IN (N'MANU_ORDER', N'SO_ORDER', N'MANU_SCHEDULE', N'WO_ORDER')
   OR panel_name LIKE N'%订单结转%' OR panel_name LIKE N'%排产%';

PRINT '=== ② 三个候选码是否存在 ===';
SELECT code AS 候选面板码, CASE WHEN EXISTS (SELECT 1 FROM yj_panel p WHERE p.panel_code = v.code) THEN N'存在' ELSE N'不存在' END AS 状态
FROM (VALUES (N'ORDER_CONVERT'), (N'SCHEDULE_BOARD'), (N'WORK_ORDER_BOARD')) v(code);

PRINT '=== ③ 各角色对 MANU_ORDER / SO_ORDER 的授权明细 ===';
SELECT r.id AS 角色ID, r.role_name AS 角色, rp.panel_code AS 面板码, rp.perms AS 权限词, rp.can_approve AS 可审批
FROM yj_role r JOIN yj_role_panel rp ON rp.role_id = r.id
WHERE rp.panel_code IN (N'MANU_ORDER', N'SO_ORDER')
ORDER BY rp.panel_code, r.id;

PRINT '=== ④ 是否有任何 yj_role_panel 行指向不存在的面板码(孤儿授权) ===';
SELECT rp.panel_code AS 面板码, COUNT(*) AS 行数
FROM yj_role_panel rp LEFT JOIN yj_panel p ON p.panel_code = rp.panel_code
WHERE p.panel_code IS NULL
GROUP BY rp.panel_code;
