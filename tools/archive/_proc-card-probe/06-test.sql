SET NOCOUNT ON;
SELECT DB_NAME() AS db, COUNT(*) AS 总行数,
       SUM(CASE WHEN ISNULL(lot_no,N'')<>'' THEN 1 ELSE 0 END) AS lot_no有值,
       SUM(CASE WHEN ISNULL([批次号],N'')<>'' THEN 1 ELSE 0 END) AS 批次号有值
FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y';
SELECT TOP 5 id, pl_no, pl_xc, lot_no, [批次号] FROM dbo.plang WHERE ISNULL(lot_no,N'')<>'' OR ISNULL([批次号],N'')<>'' ORDER BY id DESC;
SELECT N'--- proc card rows ---' AS x;
SELECT (SELECT COUNT(*) FROM dbo.wo_proc_card_head) AS head_, (SELECT COUNT(*) FROM dbo.wo_proc_card_detail) AS detail_;
