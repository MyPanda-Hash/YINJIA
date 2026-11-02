SET NOCOUNT ON;
SELECT id, pl_no, pl_xc, lot_no, [批次号], [完工状态], asp_time1 FROM dbo.plang WHERE ISNULL(lot_no,N'')<>'' ORDER BY id DESC;
SELECT N'--- 全部 12 行 ---' AS x;
SELECT id, pl_no, pl_xc, lot_no, [批次号] FROM dbo.plang ORDER BY id DESC;
