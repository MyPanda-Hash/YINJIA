SET NOCOUNT ON;
PRINT '--- 未开单:行数 / 产品数 / 涉及半成品数 ---';
WITH u AS (
  SELECT p.pl_no, p.pl_xc, p.dm, b.子件编码 AS semi
  FROM plang p
  LEFT JOIN bs_asm_bom b ON b.产品编码 = p.dm AND b.工序 = N'组装'
    AND ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.状态,N'启用') <> N'停用'
    AND UPPER(ISNULL(b.子件编码,N'')) LIKE N'%**TB'
  WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
    AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d
                    WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废')
)
SELECT COUNT(*) AS 未开单行数, COUNT(DISTINCT dm) AS 产品数, COUNT(DISTINCT semi) AS 半成品数,
       SUM(CASE WHEN semi IS NULL THEN 1 ELSE 0 END) AS 无半成品行数
FROM u;
PRINT '--- 缺产品清单(开不了组装单)的工单行 ---';
SELECT p.pl_no AS 工单号, p.pl_xc AS 行号, p.dm AS 产品, p.mc AS 产品名, p.pl_sl AS 排产数量,
       ISNULL(i.计量单位, N'') AS 单位
FROM plang p LEFT JOIN bs_inv i ON i.存货编码 = p.dm
WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM bs_asm_bom b WHERE b.产品编码 = p.dm AND b.工序 = N'组装'
                  AND ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.状态,N'启用') <> N'停用')
  AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废')
ORDER BY p.pl_no DESC;
