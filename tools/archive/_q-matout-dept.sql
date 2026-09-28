SET NOCOUNT ON;
SELECT 'bs_dept' AS t, c.name AS col FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bs_dept') AND c.name LIKE N'%编码%' OR (c.object_id=OBJECT_ID('dbo.bs_dept') AND c.name LIKE N'%名称%')
UNION ALL SELECT 'bs_emp', c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bs_emp') AND (c.name LIKE N'%编码%' OR c.name LIKE N'%名称%')
UNION ALL SELECT 'bs_wh', c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bs_wh') AND (c.name LIKE N'%编码%' OR c.name LIKE N'%名称%')
ORDER BY t, col;
GO
SELECT 'bs_dept 样例行' AS k, TOP 5 * FROM bs_dept;
GO
