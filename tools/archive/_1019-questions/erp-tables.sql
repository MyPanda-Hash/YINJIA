SET NOCOUNT ON;
GO
PRINT '=== 供应商/仓库/物料 档案表名 ==='
GO
SELECT name FROM sys.tables WHERE name IN (N'bs_supplier', N'bs_wh', N'bs_inv', N'bs_uom', N'bs_dept', N'bs_emp', N'bs_material')
   OR name LIKE N'%supplier%' OR name LIKE N'bs_%'
ORDER BY name;
GO
PRINT '=== qc_recv 头全列 ==='
GO
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.qc_recv') ORDER BY column_id;
GO
PRINT '=== qc_insp 头全列 ==='
GO
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.qc_insp') ORDER BY column_id;
GO
