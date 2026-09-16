SET NOCOUNT ON;
-- 追溯源:3 行各来自哪些单据行
SELECT N'端盖' AS 存货, h.单据编号, h.单据状态, h.单据状态2, l.实收数量 AS 数量, l.金额, '采购入库' AS 来源
FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
WHERE l.存货名称 = N'端盖' AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C')
UNION ALL
SELECT N'A级烧结炭棒/滤芯', h.单据编号, h.单据状态, h.单据状态2, l.数量, l.销售金额, '销售出库'
FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
WHERE l.存货名称 = N'A级烧结炭棒/滤芯' AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C')
UNION ALL
SELECT N'X烧结炭棒/滤芯', h.单据编号, h.单据状态, h.单据状态2, l.数量, l.销售金额, '销售出库'
FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
WHERE l.存货名称 = N'X烧结炭棒/滤芯' AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C');
-- 其他6类表有没有数据
SELECT 'bd_finish_in' AS t, COUNT(*) AS n FROM bl_finish_in UNION ALL
SELECT 'bd_other_in', COUNT(*) FROM bl_other_in UNION ALL
SELECT 'bd_outsource_in', COUNT(*) FROM bl_outsource_in UNION ALL
SELECT 'bd_material_out', COUNT(*) FROM bl_material_out UNION ALL
SELECT 'bd_other_out', COUNT(*) FROM bl_other_out UNION ALL
SELECT 'bd_outsource_issue', COUNT(*) FROM bl_outsource_issue;
