SET NOCOUNT ON;
SELECT p.pl_no AS 工单号, p.pl_xc AS 行号, p.dm AS 产品, p.mc AS 产品名, p.pl_sl AS 排产数量,
       b.子件编码 AS 半成品, b.子件名称 AS 半成品名, b.计量单位 AS 单位, b.标准用量 AS 单件用量, b.单据编号 AS 产品BOM单号
FROM plang p
JOIN bs_asm_bom b ON b.产品编码 = p.dm AND b.工序 = N'组装'
  AND ISNULL(b.asp_cancel,'N') <> 'Y' AND ISNULL(b.状态,N'启用') <> N'停用'
WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
  AND UPPER(ISNULL(b.子件编码,N'')) LIKE N'%**TB'
  AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d
                  WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废')
ORDER BY p.pl_no DESC, p.pl_xc DESC;
