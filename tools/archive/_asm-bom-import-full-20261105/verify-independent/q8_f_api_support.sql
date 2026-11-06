SET NOCOUNT ON;
-- F 支撑:多版本取数口径(与 WorkReportController.asmBomOf / MobilePickController.latestAsmBom 同 SQL)
SELECT TOP 1 N'A-48-05' AS 产品编码, 单据编号, 版本号, ISNULL(默认BOM,N'') AS 默认BOM
  FROM dbo.bs_asm_bom
 WHERE 产品编码 = N'A-48-05' AND 工序 = N'组装' AND ISNULL(asp_cancel,'N') <> 'Y'
   AND ISNULL(状态,N'启用') <> N'停用'
 GROUP BY 单据编号, 版本号, 默认BOM
 ORDER BY CASE WHEN ISNULL(默认BOM,N'') = N'是' THEN 0 ELSE 1 END, 版本号 DESC, 单据编号 DESC;
GO
SELECT TOP 1 N'B-38-17' AS 产品编码, 单据编号, 版本号, ISNULL(默认BOM,N'') AS 默认BOM
  FROM dbo.bs_asm_bom
 WHERE 产品编码 = N'B-38-17' AND 工序 = N'组装' AND ISNULL(asp_cancel,'N') <> 'Y'
   AND ISNULL(状态,N'启用') <> N'停用'
 GROUP BY 单据编号, 版本号, 默认BOM
 ORDER BY CASE WHEN ISNULL(默认BOM,N'') = N'是' THEN 0 ELSE 1 END, 版本号 DESC, 单据编号 DESC;
GO
-- 两个产品的全部单据(核对排序输入)
SELECT 产品编码, 单据编号, 版本号, ISNULL(默认BOM,N'') AS 默认BOM, COUNT(*) AS 行数
  FROM dbo.bs_asm_bom
 WHERE 产品编码 IN (N'A-48-05', N'B-38-17') AND 来源 = N'金蝶BOM引出列表_20261019174847'
 GROUP BY 产品编码, 单据编号, 版本号, 默认BOM
 ORDER BY 产品编码, 单据编号;
GO
-- 可用于活体 API 的工单行(物料编码命中 A-48-05 / B-38-17)
SELECT TOP 20 p.pl_no AS 工单号, p.pl_xc AS 行号, ISNULL(p.dm,N'') AS 物料编码, ISNULL(p.[当前工序],N'') AS 当前工序
  FROM dbo.plang p
 WHERE p.dm IN (N'A-48-05', N'B-38-17') AND ISNULL(p.asp_cancel,'N') <> 'Y'
 ORDER BY p.pl_no, p.pl_xc;
GO
