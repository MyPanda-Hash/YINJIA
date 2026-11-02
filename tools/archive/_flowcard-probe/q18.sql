SET NOCOUNT ON;
PRINT '--- line 1146 / 1147: plang 批次号 vs plang_pc 批次号 vs scjl 批次号 ---';
SELECT p.id, p.pl_no, p.pl_xc, p.[批次号] AS plang_batch, p.[工艺路线],
       (SELECT TOP 1 pc.[批次号] FROM plang_pc pc WHERE pc.plang_id=p.id) AS pc_batch,
       (SELECT TOP 1 s.[批次号] FROM scjl s WHERE s.gd_id IN (SELECT id FROM plang_pc WHERE plang_id=p.id) AND ISNULL(s.[批次号],N'')<>N'') AS scjl_batch
FROM plang p WHERE p.id IN (1146,1147,1168,1169,1170);
PRINT '--- plang_pc batch samples ---';
SELECT TOP 10 id, plang_id, pl_no, pl_xc, [批次号], lot_no FROM plang_pc ORDER BY id DESC;
PRINT '--- counts ---';
SELECT (SELECT COUNT(*) FROM plang WHERE ISNULL([批次号],N'')<>N'') plang_batch_rows,
       (SELECT COUNT(*) FROM plang_pc WHERE ISNULL([批次号],N'')<>N'') pc_batch_rows,
       (SELECT COUNT(*) FROM scjl WHERE ISNULL([批次号],N'')<>N'') scjl_batch_rows;
