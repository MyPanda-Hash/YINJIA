SET NOCOUNT ON;
PRINT '=== INSP_SUMMARY 授权行 ===';
SELECT r.role_code, r.role_name, r.is_admin, rp.perms
  FROM yj_role_panel rp JOIN yj_role r ON r.id = rp.role_id
 WHERE rp.panel_code = N'INSP_SUMMARY' ORDER BY r.role_code;

PRINT '=== 译名条数 ===';
SELECT COUNT(*) n FROM yj_translation WHERE scope='panel' AND ref_key=N'样品检验汇总表';

PRINT '=== 对照:能看 INSP_COMMISSION 的角色 ===';
SELECT r.role_code, rp.perms FROM yj_role_panel rp JOIN yj_role r ON r.id=rp.role_id
 WHERE rp.panel_code=N'INSP_COMMISSION' ORDER BY r.role_code;
GO
