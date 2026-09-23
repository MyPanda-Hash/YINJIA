SET NOCOUNT ON;
PRINT N'=== yj_role_panel 总行数 ===';
SELECT COUNT(*) AS total FROM yj_role_panel;
GO
PRINT N'=== 前 20 行 ===';
SELECT TOP 20 * FROM yj_role_panel;
GO
PRINT N'=== 按 role 统计 ===';
SELECT role_id, COUNT(*) AS n FROM yj_role_panel GROUP BY role_id;
GO
PRINT N'=== 研发相关 ===';
SELECT * FROM yj_role_panel WHERE panel_code LIKE '%RD%';
