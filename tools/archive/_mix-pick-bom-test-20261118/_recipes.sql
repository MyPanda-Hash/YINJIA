SET NOCOUNT ON;
SELECT h.产品编号 AS 配方产品, h.产品名称 AS 配方产品名, d.序号, d.物料编号, d.物料名称, d.单支物料含量, d.实际添加比例, d.设计添加量
FROM rd_mold_proc_head h JOIN rd_mold_proc_detail d ON d.单据编号 = h.单据编号
WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(d.asp_cancel,'N') <> 'Y'
  AND ISNULL(d.物料编号, N'') <> N''
ORDER BY h.产品编号, d.序号;
