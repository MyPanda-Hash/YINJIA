SET NOCOUNT ON;
SELECT STUFF((SELECT N',' + c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.wo_process_line') ORDER BY c.column_id FOR XML PATH('')),1,1,N'') AS wo_process_line列;
GO
SELECT pl_no, pl_xc, dm, mc, pl_sl, ISNULL(scx,N'') AS 生产线, ISNULL([当前工序],N'') AS 当前工序, ISNULL([完工状态],N'') AS 完工状态
FROM plang WHERE (pl_no LIKE N'GD-TEST%' OR pl_no LIKE N'GD-DEMO%') AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY pl_no, pl_xc;
GO
SELECT COUNT(*) AS 退料单数 FROM bd_material_ret;
