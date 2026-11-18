-- 02-bom-shape.sql —— BOM 数据形状体检(只读):工序分布、半成品(**TB)有没有自己的清单
SET NOCOUNT ON;

PRINT '--- A. bs_asm_bom 工序分布(全表) ---';
SELECT ISNULL(工序,N'(空)') AS 工序, COUNT(*) AS 行数, COUNT(DISTINCT 产品编码) AS 产品数
FROM bs_asm_bom
WHERE ISNULL(asp_cancel,'N') <> 'Y'
GROUP BY ISNULL(工序,N'(空)')
ORDER BY 行数 DESC;

PRINT '--- B. 半成品(**TB)在 bs_asm_bom 里作为产品出现过吗 ---';
SELECT COUNT(DISTINCT b.产品编码) AS 有清单的半成品数
FROM bs_asm_bom b
WHERE UPPER(ISNULL(b.产品编码,N'')) LIKE N'%**TB'
  AND ISNULL(b.asp_cancel,'N') <> 'Y';

PRINT '--- C. 存货档案里 **TB 半成品总数 ---';
SELECT COUNT(*) AS 半成品总数
FROM bs_inv
WHERE UPPER(ISNULL(存货编码,N'')) LIKE N'%**TB'
  AND ISNULL(asp_cancel,'N') <> 'Y';

PRINT '--- D. 未开单工单里的半成品明细(**TB 那行)长什么样 ---';
SELECT p.pl_no AS 工单号, p.pl_xc AS 行号, p.dm AS 产品, p.pl_sl AS 排产数量,
       b.子件编码 AS 半成品, b.子件名称 AS 半成品名, b.计量单位 AS 单位, b.标准用量 AS 单件用量,
       b.单据编号 AS 组装BOM单号, b.版本号 AS 版本
FROM plang p
JOIN bs_asm_bom b ON b.产品编码 = p.dm AND b.工序 = N'组装'
  AND ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.状态,N'启用') <> N'停用'
WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
  AND UPPER(ISNULL(b.子件编码,N'')) LIKE N'%**TB'
  AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d
                  WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废')
ORDER BY p.pl_no DESC, p.pl_xc DESC;
