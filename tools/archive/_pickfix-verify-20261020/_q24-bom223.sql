SET NOCOUNT ON;
SELECT c.name AS 列 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.rd_asm_bom_head') ORDER BY c.column_id;
GO
SELECT c.name AS 列 FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.rd_asm_bom_detail') ORDER BY c.column_id;
GO
SELECT TOP 5 * FROM dbo.rd_asm_bom_head;
