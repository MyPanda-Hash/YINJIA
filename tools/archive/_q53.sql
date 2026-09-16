-- 修:视图加 asp_cancel 常量列(平表查询过滤用)
SET NOCOUNT ON;
IF OBJECT_ID('dbo.v_stock_balance') IS NOT NULL DROP VIEW dbo.v_stock_balance;
EXEC(N'
CREATE VIEW dbo.v_stock_balance AS
WITH movements AS (
  SELECT l.仓库 AS 仓库, l.存货编码 AS 存货编码, l.存货名称 AS 存货,
         l.规格型号 AS 规格型号, l.计量单位 AS 主计量,
         CAST(l.实收数量 AS decimal(18,4)) AS 数量, CAST(l.金额 AS decimal(18,4)) AS 金额, ''IN'' AS 方向
  FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
  UNION ALL
  SELECT l.仓库, l.产品编码, l.产品名称, l.规格型号, l.计量单位,
         CAST(l.实收数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), ''IN''
  FROM bl_finish_in l JOIN bd_finish_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
  UNION ALL
  SELECT l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位,
         CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), ''IN''
  FROM bl_other_in l JOIN bd_other_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
  UNION ALL
  SELECT l.仓库, l.产品编码, l.产品名称, l.规格型号, l.计量单位,
         CAST(l.实收数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), ''IN''
  FROM bl_outsource_in l JOIN bd_outsource_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
  UNION ALL
  SELECT l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位,
         CAST(l.数量 AS decimal(18,4)), CAST(l.销售金额 AS decimal(18,4)), ''OUT''
  FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
  UNION ALL
  SELECT l.仓库, l.材料编码, l.材料名称, l.规格型号, l.计量单位,
         CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), ''OUT''
  FROM bl_material_out l JOIN bd_material_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
  UNION ALL
  SELECT l.仓库, l.存货编码, l.存货名称, l.规格型号, l.计量单位,
         CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), ''OUT''
  FROM bl_other_out l JOIN bd_other_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
  UNION ALL
  SELECT l.仓库, l.材料编码, l.材料名称, l.规格型号, l.计量单位,
         CAST(l.数量 AS decimal(18,4)), CAST(l.金额 AS decimal(18,4)), ''OUT''
  FROM bl_outsource_issue l JOIN bd_outsource_issue h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
),
agg AS (
  SELECT
    w.仓库编码 AS 仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量,
    SUM(CASE WHEN m.方向=''IN'' THEN m.数量 ELSE -m.数量 END) AS [现存量],
    CASE WHEN SUM(CASE WHEN m.方向=''IN'' THEN m.数量 ELSE -m.数量 END) <> 0
         THEN SUM(CASE WHEN m.方向=''IN'' THEN m.金额 ELSE -m.金额 END)
              / SUM(CASE WHEN m.方向=''IN'' THEN m.数量 ELSE -m.数量 END)
         ELSE 0 END AS [结存单价],
    SUM(CASE WHEN m.方向=''IN'' THEN m.金额 ELSE -m.金额 END) AS [结存金额]
  FROM movements m
  LEFT JOIN dbo.bs_wh w ON w.仓库名称 = m.仓库
  GROUP BY w.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量
)
SELECT ROW_NUMBER() OVER(ORDER BY 仓库, 存货编码, 存货) AS id, *,
       CAST(''N'' AS char(1)) AS asp_cancel
FROM agg;
');
SELECT COUNT(*) AS 行数 FROM v_stock_balance WHERE ISNULL(asp_cancel,'N')<>'Y';
