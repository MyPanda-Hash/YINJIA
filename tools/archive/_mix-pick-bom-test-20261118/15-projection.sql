SET NOCOUNT ON;
PRINT '--- A. 两个补出来的产品组装清单 ---';
SELECT 单据编号, 行序, 子件编码, 子件名称, 计量单位, 标准用量 FROM bs_asm_bom
WHERE 产品编码 IN (N'D-01-18', N'T042-6') AND 来源 = N'测试库演示_组装清单套用_20261118'
ORDER BY 单据编号, 行序;
GO
PRINT '--- B. 28 张未开单工单:组装单/混料单能不能出(按代码同口径预演) ---';
SELECT p.pl_no AS 工单号, p.pl_xc AS 行号, p.dm AS 产品, p.pl_sl AS 排产数量,
       ISNULL(semi.半成品, N'-') AS 半成品,
       CASE WHEN semi.半成品 IS NULL THEN N'无半成品行'
            WHEN mixBom.清单行 IS NULL OR mixBom.清单行 = 0 THEN N'半成品无清单 ⇒ 只出组装单'
            ELSE N'可出组装+混料两张单' END AS 预演结果,
       ISNULL(mixBom.清单行, 0) AS 半成品清单行数
FROM plang p
OUTER APPLY (
   SELECT TOP 1 b.子件编码 AS 半成品 FROM bs_asm_bom b
    WHERE b.产品编码 = p.dm AND b.工序 = N'组装' AND ISNULL(b.asp_cancel,'N') <> 'Y'
      AND ISNULL(b.状态,N'启用') <> N'停用' AND UPPER(ISNULL(b.子件编码,N'')) LIKE N'%**TB'
    ORDER BY CASE WHEN ISNULL(b.默认BOM,N'') = N'是' THEN 0 ELSE 1 END, b.版本号 DESC, b.单据编号 DESC
) semi
OUTER APPLY (
   SELECT COUNT(*) AS 清单行 FROM bs_asm_bom x
    WHERE x.产品编码 = semi.半成品 AND x.工序 = N'组装' AND ISNULL(x.asp_cancel,'N') <> 'Y'
      AND ISNULL(x.状态,N'启用') <> N'停用' AND ISNULL(x.子件编码,N'') <> N''
) mixBom
WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM wo_pick_doc d WHERE d.工单号 = p.pl_no AND d.工单行号 = p.pl_xc AND d.状态 <> N'已作废')
ORDER BY 预演结果, p.pl_no DESC, p.pl_xc DESC;
