SET NOCOUNT ON;
SELECT COUNT(*) total, SUM(CASE WHEN ISNULL(lot_no,N'')<>N'' THEN 1 ELSE 0 END) with_lot,
       SUM(CASE WHEN ISNULL([批次号],N'')<>N'' THEN 1 ELSE 0 END) with_batch
FROM plang;
PRINT '--- plang pl_date range ---';
SELECT MIN(pl_date), MAX(pl_date) FROM plang;
PRINT '--- scjl lot_no by plang_pc line sample ---';
SELECT TOP 10 s.id, s.[报工单号], s.gldh, s.gxdm, s.lot_no, s.[批次号], s.gd_id, pc.plang_id, p.pl_xc, p.lot_no AS plang_lot, CONVERT(varchar(10), s.sc_date,120) sc_date
FROM scjl s LEFT JOIN plang_pc pc ON pc.id=s.gd_id LEFT JOIN plang p ON p.id=pc.plang_id
ORDER BY s.id DESC;
PRINT '--- distinct scjl batch counts ---';
SELECT COUNT(DISTINCT lot_no) n FROM scjl WHERE ISNULL(lot_no,N'')<>N'';
