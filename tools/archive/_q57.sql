SET NOCOUNT ON;
IF OBJECT_ID('dbo.v_stock_balance') IS NOT NULL DROP VIEW dbo.v_stock_balance;
EXEC(N'
CREATE VIEW dbo.v_stock_balance AS
WITH movements AS (
  -- 入库:有 单据状态2 列的表(金蝶同步)兼容两种状态
  SELECT l.仓库, l.存货编码, l.存货名称 AS 存货, l.规格型号, l.计量单位 AS 主计量,
         CAST(l.实收数量 AS decimal(18,4)) AS 数量, CAST(l.金额 AS decimal(18,4)) AS 金额, 1 AS sign
  FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
    AND (h.单据状态=N''已审核'' OR ISNULL(h.单据状态2,'''')=''C'')
  UNION ALL
  SELECT l.仓库, l.产品编码, l.产品名称, l.规格型号, l.计量单位, CAST(l.实收数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), 1
  FROM bl_finish_in l JOIN bd_finish_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位, CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), 1
  FROM bl_other_in l JOIN bd_other_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT l.仓库, l.产品编码, l.产品名称, l.规格型号, l.计量单位, CAST(l.实收数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), 1
  FROM bl_outsource_in l JOIN bd_outsource_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位, CAST(l.数量 AS decimal(18,4)), CAST(l.销售金额 AS decimal(18,4)), -1
  FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
    AND (h.单据状态=N''已审核'' OR ISNULL(h.单据状态2,'''')=''C'')
  UNION ALL
  SELECT l.仓库, l.材料编码, l.材料名称, l.规格型号, l.计量单位, CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), -1
  FROM bl_material_out l JOIN bd_material_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位, CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), -1
  FROM bl_other_out l JOIN bd_other_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  SELECT l.仓库, l.材料编码, l.材料名称, l.规格型号, l.计量单位, CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), -1
  FROM bl_outsource_issue l JOIN bd_outsource_issue h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
)
SELECT ROW_NUMBER() OVER(ORDER BY m.仓库,m.存货编码,m.存货) AS id,
       w.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量,
       SUM(m.数量*m.sign) AS 现存量,
       CASE WHEN SUM(m.数量*m.sign)<>0 THEN SUM(m.金额*m.sign)/SUM(m.数量*m.sign) ELSE 0 END AS 结存单价,
       SUM(m.金额*m.sign) AS 结存金额,
       CAST(''N'' AS char(1)) AS asp_cancel
FROM movements m LEFT JOIN dbo.bs_wh w ON w.仓库名称=m.仓库
GROUP BY w.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量;
');
SELECT COUNT(*) AS 已审核口径行数 FROM v_stock_balance;
SELECT TOP 3 仓库, LEFT(存货,14) AS 存货, 现存量, 结存金额 FROM v_stock_balance;
