SET NOCOUNT ON;
PRINT '--- A. 刚建的其他出库单/退料单(含明细行数) ---';
SELECT h.单据编号, h.单据日期, ISNULL(h.业务类型,N'') AS 业务类型,
       (SELECT COUNT(*) FROM bl_other_out l WHERE l.单据编号 = h.单据编号) AS 其他出库明细行
FROM bd_other_out h WHERE h.单据编号 >= N'OO-2026-11-0006' ORDER BY h.单据编号;
GO
SELECT h.单据编号, ISNULL(h.业务类型,N'') AS 业务类型,
       (SELECT COUNT(*) FROM bl_material_ret l WHERE l.单据编号 = h.单据编号) AS 退料明细行
FROM bd_material_ret h WHERE h.单据编号 >= N'TL-2026-11-0008' ORDER BY h.单据编号;
