SET NOCOUNT ON;
;WITH r AS (
  SELECT h.产品编号 AS 产品, h.产品名称 AS 产品名, d.序号, d.物料编号, d.物料名称, d.单支物料含量, d.实际添加比例,
         ROW_NUMBER() OVER (PARTITION BY h.产品编号, d.序号, d.物料编号 ORDER BY h.单据日期 DESC) AS rn
  FROM rd_mold_proc_head h JOIN rd_mold_proc_detail d ON d.单据编号 = h.单据编号
  WHERE ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(d.asp_cancel,'N') <> 'Y'
    AND ISNULL(d.物料编号,N'') <> N''
)
SELECT 产品, 产品名, 序号, 物料编号, 物料名称, 单支物料含量 AS 单支含量g, 实际添加比例
FROM r WHERE rn = 1 ORDER BY 产品, 序号;
