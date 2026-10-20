SET NOCOUNT ON;
GO
PRINT '=== yj_panel 列 ==='
GO
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_panel') ORDER BY column_id;
GO
PRINT '=== GFDA / QC_RETURN 面板表映射 ==='
GO
SELECT * FROM dbo.yj_panel WHERE panel_code IN ('GFDA', 'QC_RETURN');
GO
PRINT '=== 供应商相关表(含 供应商编码 列) ==='
GO
SELECT OBJECT_NAME(c.object_id) AS 表, c.name AS 列 FROM sys.columns c
WHERE c.name IN (N'供应商编码', N'供应商名称') AND OBJECTPROPERTY(c.object_id, 'IsUserTable') = 1
ORDER BY 表, 列;
GO
