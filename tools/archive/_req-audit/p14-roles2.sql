SET NOCOUNT ON;
PRINT N'=== 2. RD 面板权限行 ===';
SELECT role_id, panel_code, can_approve, LEFT(perms, 300) AS perms FROM yj_role_panel
WHERE panel_code IN ('RD_APPROVAL','RD_PLAN','RD_SPEC_DOC','RD_ASM_PROC','RD_INSP_PLAN','RD_DOM_TEST','RD_PROD_INFO','RD_FILTER_EFF','RD_ALKALINE')
ORDER BY panel_code, role_id;
GO
PRINT N'=== 3. yj_role 清单 ===';
SELECT * FROM yj_role;
GO
PRINT N'=== 4. perms 里出现的全部动作词(去重统计) ===';
SELECT TOP 80 panel_code, perms FROM yj_role_panel WHERE panel_code='RD_SPEC_DOC';
GO
PRINT N'=== 5. can_approve=Y 的面板数 by role ===';
SELECT role_id, COUNT(*) AS total, SUM(CASE WHEN can_approve='Y' THEN 1 ELSE 0 END) AS approvable FROM yj_role_panel GROUP BY role_id;
