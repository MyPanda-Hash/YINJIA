SET NOCOUNT ON;
PRINT '== 模拟 MixBomService.of:候选 = A-48-41**TB / A-48-41 ==';
SELECT TOP 1 b.[单据编号] AS no, b.[产品编号] AS prod, ISNULL(b.[产品名称],N'') AS pname,
       ISNULL(b.[烧结类型],N'') AS stype, ISNULL(b.[来源单号],N'') AS src,
       MAX(ISNULL(b.[版本号],N'')) AS ver
  FROM dbo.bs_mix_bom b
 WHERE b.[产品编号] IN (N'A-48-41**TB', N'A-48-41', N'A-48-41')
   AND ISNULL(b.asp_cancel,'N') <> 'Y'
   AND ISNULL(b.[状态],N'启用') <> N'停用'
   AND NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status s WHERE s.panel_code = 'MIX_BOM'
       AND s.doc_no = b.[单据编号] AND s.canceled = 'Y')
 GROUP BY b.[单据编号], b.[产品编号], b.[产品名称], b.[烧结类型], b.[来源单号]
 ORDER BY CASE WHEN ISNULL(b.[烧结类型],N'') = N'烧结工艺清单' THEN 0
               WHEN ISNULL(b.[烧结类型],N'') = N'X烧结工艺清单' THEN 1 ELSE 2 END,
          MAX(ISNULL(b.[版本号],N'')) DESC, b.[单据编号] DESC;

PRINT '== 模拟 linesOf:行 + 存货单位 ==';
SELECT ISNULL(b.[行序],0) AS seq, ISNULL(b.[物料编号],N'') AS code, ISNULL(b.[物料名称],N'') AS name,
       ISNULL(b.[单支含量g],N'') AS content, ISNULL(i.[计量单位],N'') AS unit
  FROM dbo.bs_mix_bom b
  LEFT JOIN dbo.bs_inv i ON i.[存货编码] = b.[物料编号] AND ISNULL(i.asp_cancel,'N') <> 'Y'
 WHERE b.[单据编号] = N'MIX-2026-11-0001' AND ISNULL(b.asp_cancel,'N') <> 'Y'
 ORDER BY ISNULL(b.[行序],999), b.id;

PRINT '== 有没有用的上的工单(A-48-41 / B-92-25) ==';
SELECT TOP 10 p.pl_no, p.pl_xc, p.dm, p.mc, p.pl_sl, p.scx FROM dbo.plang p
 WHERE p.dm IN (N'A-48-41', N'B-92-25') AND ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.pl_sl,0)>0;

PRINT '== 组装清单里半成品(**TB) → 归一后的编码(样本) ==';
SELECT TOP 10 b.单据编号, b.产品编码, b.子件编码, b.标准用量 FROM dbo.bs_asm_bom b
 WHERE b.子件编码 LIKE '%**TB%' AND b.产品编码 IN (SELECT DISTINCT dm FROM dbo.plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(pl_sl,0)>0);
