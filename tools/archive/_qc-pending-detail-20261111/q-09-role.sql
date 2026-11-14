SET NOCOUNT ON;
PRINT N'=== A. yj_role_panel 列 ===';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.yj_role_panel') ORDER BY c.column_id;
PRINT N'=== B. PU_ORDER_DETAIL / QC_CATALOG 的权限行数 ===';
SELECT panel_code, COUNT(*) AS n FROM yj_role_panel WHERE panel_code IN (N'PU_ORDER_DETAIL', N'PU_ORDER_STATS', N'QC_CATALOG', N'QC_INSP_REC') GROUP BY panel_code;
PRINT N'=== C. 角色表 ===';
SELECT id, role_code, role_name FROM yj_role;
PRINT N'=== D. QC_CATALOG 权限行明细 ===';
SELECT * FROM yj_role_panel WHERE panel_code = N'QC_CATALOG';
