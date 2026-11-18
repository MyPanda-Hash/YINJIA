SET NOCOUNT ON;
PRINT '== 模拟 MixBomService.of(A-48-41**TB) 文案与行 ==';
SELECT TOP 1 b.[单据编号] AS no, b.[产品编号] AS prod, ISNULL(b.[烧结类型],N'') AS stype,
       MAX(ISNULL(b.[版本号],N'')) AS ver
  FROM dbo.bs_mix_bom b
 WHERE b.[产品编号] IN (N'A-48-41**TB', N'A-48-41')
   AND ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.[状态],N'启用') <> N'停用'
   AND NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status s WHERE s.panel_code='MIX_BOM' AND s.doc_no=b.[单据编号] AND s.canceled='Y')
 GROUP BY b.[单据编号], b.[产品编号], b.[产品名称], b.[烧结类型], b.[来源单号]
 ORDER BY CASE WHEN ISNULL(b.[烧结类型],N'')=N'烧结工艺清单' THEN 0 WHEN ISNULL(b.[烧结类型],N'')=N'X烧结工艺清单' THEN 1 ELSE 2 END,
          MAX(ISNULL(b.[版本号],N'')) DESC, b.[单据编号] DESC;

PRINT '== 行 + 单位换算后的单件用量(kg/千克 ÷1000) ==';
SELECT b.[行序], b.[物料编号], b.[物料名称], b.[单支含量g], ISNULL(i.[计量单位],N'') AS unit,
       CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(i.[计量单位],N'')))) IN (N'kg',N'千克',N'公斤')
            THEN TRY_CAST(REPLACE(b.[单支含量g],N',',N'') AS float)/1000.0
            ELSE TRY_CAST(REPLACE(b.[单支含量g],N',',N'') AS float) END AS 单件用量,
       ROUND(CASE WHEN LOWER(LTRIM(RTRIM(ISNULL(i.[计量单位],N'')))) IN (N'kg',N'千克',N'公斤')
            THEN TRY_CAST(REPLACE(b.[单支含量g],N',',N'') AS float)/1000.0
            ELSE TRY_CAST(REPLACE(b.[单支含量g],N',',N'') AS float) END * p.pl_sl, 4) AS 应投
  FROM dbo.bs_mix_bom b
  LEFT JOIN dbo.bs_inv i ON i.[存货编码]=b.[物料编号] AND ISNULL(i.asp_cancel,'N')<>'Y'
  CROSS JOIN (SELECT TOP 1 pl_sl FROM dbo.plang WHERE pl_no=N'GD-2026-09-0135' AND pl_xc=1) p
 WHERE b.[单据编号]=N'MIX-2026-11-0001' AND ISNULL(b.asp_cancel,'N')<>'Y'
 ORDER BY b.[行序], b.id;
