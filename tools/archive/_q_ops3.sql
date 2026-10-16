SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.bd_material_out') AND (name LIKE N'%工序%' OR name LIKE N'%工单%' OR name LIKE N'%批%') ORDER BY name;
PRINT '---plang ops---';
SELECT ISNULL([工艺路线],N'(kong)') AS route, COUNT(*) AS cnt FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY [工艺路线];
