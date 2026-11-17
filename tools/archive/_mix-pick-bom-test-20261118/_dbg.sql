SET NOCOUNT ON;
SELECT 单据编号, 产品编号, 产品名称, 版本号, ISNULL(asp_cancel,'N') AS headCancel FROM rd_mold_proc_head
WHERE 单据编号 IN (N'GD-2026-10-0206', N'GD-2026-10-0227', N'GD-2026-10-0229');
GO
SELECT 单据编号, COUNT(*) AS 行, SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 作废行,
       SUM(CASE WHEN ISNULL(物料编号,N'')='' THEN 1 ELSE 0 END) AS 空物料行
FROM rd_mold_proc_detail WHERE 单据编号 IN (N'GD-2026-10-0206', N'GD-2026-10-0227', N'GD-2026-10-0229')
GROUP BY 单据编号;
GO
SELECT 单据编号, 序号, 物料编号, 物料名称, 单支物料含量 FROM rd_mold_proc_detail WHERE 单据编号 = N'GD-2026-10-0206' ORDER BY 序号;
