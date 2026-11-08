SET NOCOUNT ON;
SELECT N'HSDZ_MES' AS db, r.id AS role_id, r.role_name AS role, r.is_admin AS is_admin, p.perms AS perms
FROM yj_role_panel p JOIN yj_role r ON r.id = p.role_id
WHERE p.panel_code = N'WORK_ORDER_PROGRESS'
ORDER BY r.id;
GO
SELECT N'translation' AS what, locale, text, source FROM yj_translation
WHERE scope = 'panel' AND ref_key = N'生产工序进度看板';
GO
