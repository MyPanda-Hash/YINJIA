SET NOCOUNT ON;
PRINT '=== bs_wh 列 ===';
SELECT c.name, t.name AS typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.bs_wh') ORDER BY c.column_id;
PRINT '=== bs_wh 数据 ===';
SELECT [仓库编码],[仓库名称],[状态] FROM bs_wh ORDER BY id;
PRINT '=== bs_wh_loc 行数(按仓) ===';
SELECT [仓库] AS wh, COUNT(*) n, SUM(CASE WHEN [停用]=1 THEN 1 ELSE 0 END) disabled FROM bs_wh_loc WHERE ISNULL([asp_cancel],'N')<>'Y' GROUP BY [仓库] ORDER BY n DESC;
