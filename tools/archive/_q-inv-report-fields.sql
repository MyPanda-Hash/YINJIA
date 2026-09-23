-- _q-inv-report-fields.sql — 一次性探针:库存报表三面板(STOCK_BALANCE/LEDGER/SUMMARY)字段补齐决策依据
-- 结论:①仓库改用仓库编码 ②批号缺失(可追溯) ③出库用售价致结存金额为负 ④29行金额缺失
-- 口径:HSDZ_MES 实测(采购入库149行/销售出库123行/材料出库2行,其余5类0行),2026-09-21
SET NOCOUNT ON;

-- ══ 1) 8 类单据真实行数(只有采购+销售构成库存) ══
SELECT 'bl_purchase_in' AS tbl, COUNT(*) AS 行数 FROM bl_purchase_in
UNION ALL SELECT 'bl_finish_in', COUNT(*) FROM bl_finish_in
UNION ALL SELECT 'bl_other_in', COUNT(*) FROM bl_other_in
UNION ALL SELECT 'bl_outsource_in', COUNT(*) FROM bl_outsource_in
UNION ALL SELECT 'bl_sale_out', COUNT(*) FROM bl_sale_out
UNION ALL SELECT 'bl_material_out', COUNT(*) FROM bl_material_out
UNION ALL SELECT 'bl_other_out', COUNT(*) FROM bl_other_out
UNION ALL SELECT 'bl_outsource_issue', COUNT(*) FROM bl_outsource_issue;
GO

-- ══ 2) 仓库维度:名称 vs 编码(视图现用名称 bs_wh.仓库名称=仓库, 且 NULL 29+15 行) ══
SELECT 'bl_purchase_in' AS tbl, k.col, CASE k.col
  WHEN N'仓库(名称)' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([仓库] AS nvarchar(200)))),N'')) FROM bl_purchase_in)
  WHEN N'仓库编码' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([仓库编码] AS nvarchar(200)))),N'')) FROM bl_purchase_in)
  WHEN N'存货编码' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([存货编码] AS nvarchar(200)))),N'')) FROM bl_purchase_in)
  ELSE NULL END AS nonblank
FROM (VALUES (N'仓库(名称)'),(N'仓库编码'),(N'存货编码')) AS k(col)
UNION ALL
SELECT 'bl_sale_out', k.col, CASE k.col
  WHEN N'仓库(名称)' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([仓库] AS nvarchar(200)))),N'')) FROM bl_sale_out)
  WHEN N'仓库编码' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([仓库编码] AS nvarchar(200)))),N'')) FROM bl_sale_out)
  WHEN N'存货编码' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([存货编码] AS nvarchar(200)))),N'')) FROM bl_sale_out)
  ELSE NULL END
FROM (VALUES (N'仓库(名称)'),(N'仓库编码'),(N'存货编码')) AS k(col);
GO

-- 采购/销售侧 (存货,仓库) 组合交集 → 单边分区=负现存量
;WITH p AS (SELECT DISTINCT 存货编码, 仓库 FROM bl_purchase_in),
      s AS (SELECT DISTINCT 存货编码, 仓库 FROM bl_sale_out)
SELECT (SELECT COUNT(*) FROM p) AS 采购组合, (SELECT COUNT(*) FROM s) AS 销售组合,
       (SELECT COUNT(*) FROM p JOIN s ON p.存货编码=s.存货编码 AND p.仓库=s.仓库) AS 完全一致组合,
       (SELECT COUNT(*) FROM s WHERE NOT EXISTS (SELECT 1 FROM p
                WHERE p.存货编码=s.存货编码 AND p.仓库=s.仓库)) AS 仅销售有(必为负);
GO

SELECT COUNT(*) AS 总行数,
       SUM(CASE WHEN 现存量 < 0 THEN 1 ELSE 0 END) AS 负现存量行数,
       SUM(CASE WHEN 仓库 IS NULL OR LTRIM(RTRIM(仓库))='' THEN 1 ELSE 0 END) AS 仓库为空行,
       SUM(结存金额) AS 结存金额合计
FROM v_stock_balance;
GO

-- ══ 3) 批号:两侧都有值且 87 个批号可串起采购→销售(批次台账成立) ══
SELECT (SELECT COUNT(*) FROM bl_purchase_in WHERE 批号 IS NOT NULL AND LTRIM(RTRIM(批号))<>'') AS 采购批号行,
       (SELECT COUNT(*) FROM bl_purchase_in WHERE 批号 IS NULL OR LTRIM(RTRIM(批号))='') AS 采购批号空,
       (SELECT COUNT(*) FROM bl_sale_out WHERE 批号 IS NOT NULL AND LTRIM(RTRIM(批号))<>'') AS 销售批号行,
       (SELECT COUNT(*) FROM bl_sale_out WHERE 批号 IS NULL OR LTRIM(RTRIM(批号))='') AS 销售批号空;
GO

WITH pin AS (SELECT DISTINCT 批号 FROM bl_purchase_in WHERE 批号 IS NOT NULL AND LTRIM(RTRIM(批号))<>''),
     sout AS (SELECT DISTINCT 批号 FROM bl_sale_out WHERE 批号 IS NOT NULL AND LTRIM(RTRIM(批号))<>'')
SELECT (SELECT COUNT(*) FROM pin) AS 采购批号数, (SELECT COUNT(*) FROM sout) AS 销售批号数,
       (SELECT COUNT(*) FROM pin JOIN sout ON pin.批号 = sout.批号) AS 两侧都有;
GO

SELECT (SELECT COUNT(DISTINCT 仓库 + '|' + 存货编码) FROM v_stock_ledger) AS 仓库存货组合,
       (SELECT COUNT(DISTINCT 仓库 + '|' + 存货编码 + '|' + ISNULL(批号,N'')) FROM (
            SELECT 仓库, 存货编码, 批号 FROM bl_purchase_in
            UNION ALL SELECT 仓库, 存货编码, 批号 FROM bl_sale_out) x) AS 加批号后组合;
GO

-- ══ 4) 出库售价口径:结存金额为负的算术来源 ══
SELECT SUM(收入金额) AS 累计收入金额, SUM(发出金额) AS 累计发出金额,
       SUM(收入金额 - 发出金额) AS 结存金额合计 FROM v_stock_ledger;
GO

SELECT TOP 8 存货编码,
       SUM(收入数量) AS 入库数量, CASE WHEN SUM(收入数量)<>0 THEN SUM(收入金额)/SUM(收入数量) ELSE 0 END AS 入库均价,
       SUM(发出数量) AS 出库数量, CASE WHEN SUM(发出数量)<>0 THEN SUM(发出金额)/SUM(发出数量) ELSE 0 END AS 出库均价
FROM v_stock_ledger GROUP BY 存货编码
HAVING SUM(发出数量) > 0 AND SUM(收入数量) > 0 ORDER BY SUM(发出金额) DESC;
GO

-- 出库成本是否可用于修正:成本列类型 nvarchar 且值全 0
SELECT COUNT(*) AS 成本有值行, SUM(TRY_CAST(成本 AS decimal(18,4))) AS 成本合计, COUNT(成本价) AS 成本价有值行
FROM bl_sale_out;
GO

-- ══ 5) 金额缺失(含税金额/税率可兜底) ══
SELECT COUNT(*) AS 总行, COUNT(金额) AS 金额有值, COUNT(含税金额) AS 含税金额有值, COUNT(含税单价) AS 含税单价有值
FROM bl_purchase_in;
GO

SELECT h.单据状态, COUNT(*) AS 行数 FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
WHERE l.金额 IS NULL GROUP BY h.单据状态;
GO

-- ══ 6) 候选字段填充率(决定加/不加) ══
SELECT 'bl_purchase_in' AS tbl, k.col, CASE k.col
  WHEN N'保质期到期日' THEN (SELECT COUNT(保质期到期日) FROM bl_purchase_in)
  WHEN N'有效期至' THEN (SELECT COUNT(有效期至) FROM bl_purchase_in)
  WHEN N'仓位编码' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([仓位编码] AS nvarchar(200)))),N'')) FROM bl_purchase_in)
  WHEN N'辅助属性名称' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([辅助属性名称] AS nvarchar(200)))),N'')) FROM bl_purchase_in)
  WHEN N'序列号清单' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([序列号清单] AS nvarchar(200)))),N'')) FROM bl_purchase_in)
  WHEN N'单价' THEN (SELECT COUNT(单价) FROM bl_purchase_in)
  WHEN N'含税单价' THEN (SELECT COUNT(含税单价) FROM bl_purchase_in)
  WHEN N'计量单位2' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([计量单位2] AS nvarchar(200)))),N'')) FROM bl_purchase_in)
  WHEN N'是否赠品' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([是否赠品] AS nvarchar(200)))),N'')) FROM bl_purchase_in)
  ELSE NULL END AS nonblank
FROM (VALUES (N'保质期到期日'),(N'有效期至'),(N'仓位编码'),(N'辅助属性名称'),(N'序列号清单'),
 (N'单价'),(N'含税单价'),(N'计量单位2'),(N'是否赠品')) AS k(col)
UNION ALL
SELECT 'bl_sale_out', k.col, CASE k.col
  WHEN N'保质期到期日' THEN (SELECT COUNT(保质期到期日) FROM bl_sale_out)
  WHEN N'有效期至' THEN (SELECT COUNT(有效期至) FROM bl_sale_out)
  WHEN N'仓位编码' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([仓位编码] AS nvarchar(200)))),N'')) FROM bl_sale_out)
  WHEN N'辅助属性名称' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([辅助属性名称] AS nvarchar(200)))),N'')) FROM bl_sale_out)
  WHEN N'序列号清单' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([序列号清单] AS nvarchar(200)))),N'')) FROM bl_sale_out)
  WHEN N'售价' THEN (SELECT COUNT(售价) FROM bl_sale_out)
  WHEN N'含税售价' THEN (SELECT COUNT(含税售价) FROM bl_sale_out)
  WHEN N'含税销售金额' THEN (SELECT COUNT(含税销售金额) FROM bl_sale_out)
  WHEN N'税额' THEN (SELECT COUNT(税额) FROM bl_sale_out)
  WHEN N'是否赠品' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([是否赠品] AS nvarchar(200)))),N'')) FROM bl_sale_out)
  ELSE NULL END
FROM (VALUES (N'保质期到期日'),(N'有效期至'),(N'仓位编码'),(N'辅助属性名称'),(N'序列号清单'),
 (N'售价'),(N'含税售价'),(N'含税销售金额'),(N'税额'),(N'是否赠品')) AS k(col);
GO

SELECT 'bd_purchase_in' AS tbl, k.col, CASE k.col
  WHEN N'供应商编码' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([供应商编码] AS nvarchar(200)))),N'')) FROM bd_purchase_in)
  WHEN N'经手人' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([经手人] AS nvarchar(200)))),N'')) FROM bd_purchase_in)
  WHEN N'采购订单号' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([采购订单号] AS nvarchar(200)))),N'')) FROM bd_purchase_in)
  WHEN N'项目' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([项目] AS nvarchar(200)))),N'')) FROM bd_purchase_in)
  WHEN N'部门' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([部门] AS nvarchar(200)))),N'')) FROM bd_purchase_in)
  WHEN N'合同号' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([合同号] AS nvarchar(200)))),N'')) FROM bd_purchase_in)
  WHEN N'来源单号' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([来源单号] AS nvarchar(200)))),N'')) FROM bd_purchase_in)
  WHEN N'入库类别' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([入库类别] AS nvarchar(200)))),N'')) FROM bd_purchase_in)
  ELSE NULL END AS nonblank
FROM (VALUES (N'供应商编码'),(N'经手人'),(N'采购订单号'),(N'项目'),(N'部门'),
 (N'合同号'),(N'来源单号'),(N'入库类别')) AS k(col)
UNION ALL
SELECT 'bd_sale_out', k.col, CASE k.col
  WHEN N'客户编码' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([客户编码] AS nvarchar(200)))),N'')) FROM bd_sale_out)
  WHEN N'经手人' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([经手人] AS nvarchar(200)))),N'')) FROM bd_sale_out)
  WHEN N'销售订单号' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([销售订单号] AS nvarchar(200)))),N'')) FROM bd_sale_out)
  WHEN N'项目' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([项目] AS nvarchar(200)))),N'')) FROM bd_sale_out)
  WHEN N'部门' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([部门] AS nvarchar(200)))),N'')) FROM bd_sale_out)
  WHEN N'出库类别' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([出库类别] AS nvarchar(200)))),N'')) FROM bd_sale_out)
  WHEN N'来源单号' THEN (SELECT COUNT(NULLIF(LTRIM(RTRIM(CAST([来源单号] AS nvarchar(200)))),N'')) FROM bd_sale_out)
  WHEN N'发货日期' THEN (SELECT COUNT(发货日期) FROM bd_sale_out)
  ELSE NULL END
FROM (VALUES (N'客户编码'),(N'经手人'),(N'销售订单号'),(N'项目'),(N'部门'),
 (N'出库类别'),(N'来源单号'),(N'发货日期')) AS k(col);
GO

-- ══ 7) 硬约束验证:8 表列可用性 + 递归 CTE 视图上限 + 成本三口径 ══
-- 只有 bl_purchase_in/bl_sale_out 有 仓库编码;批号 8 表都有;id 均 int
SELECT t.name AS tbl, c.name AS col, ty.name AS typ
FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name IN ('bl_purchase_in','bl_finish_in','bl_other_in','bl_outsource_in',
                 'bl_sale_out','bl_material_out','bl_other_out','bl_outsource_issue')
  AND c.name IN ('id','仓库编码','仓库','批号') ORDER BY t.name, c.name;
GO

-- 递归 CTE 可建视图,但视图不能带 OPTION(MAXRECURSION) → 默认 100 行封顶
IF OBJECT_ID('dbo._probe_rec_big') IS NOT NULL DROP VIEW dbo._probe_rec_big;
GO
BEGIN TRY EXEC(N'CREATE VIEW dbo._probe_rec_big AS
  WITH r AS (SELECT CAST(1 AS int) AS n UNION ALL SELECT n+1 FROM r WHERE n < 300)
  SELECT n FROM r'); END TRY BEGIN CATCH END CATCH
GO
IF OBJECT_ID('dbo._probe_rec_big') IS NOT NULL
  BEGIN TRY SELECT COUNT(*) AS 行数 FROM dbo._probe_rec_big; END TRY
  BEGIN CATCH SELECT ERROR_MESSAGE() AS 超100迭代错误; END CATCH   -- 台账 235 行即死于此
GO
IF OBJECT_ID('dbo._probe_rec_big') IS NOT NULL DROP VIEW dbo._probe_rec_big;
GO

-- 成本三口径对比:售价(现状) / 累计入库加权(可进视图) / 真·移动加权(须存储过程)
SELECT N'售价口径(现状)' AS 方法, SUM(收入金额 - 发出金额) AS 结存金额合计 FROM v_stock_ledger;
GO
SELECT N'累计入库加权平均' AS 方法,
       CAST(SUM(CASE WHEN 累计入数量 <> 0 THEN 累计入金额/累计入数量 ELSE 0 END * 净数量) AS decimal(18,2)) AS 结存金额合计
FROM (SELECT 仓库, 存货编码, SUM(收入数量) AS 累计入数量, SUM(收入金额) AS 累计入金额,
             SUM(收入数量 - 发出数量) AS 净数量
      FROM v_stock_ledger GROUP BY 仓库, 存货编码) b;
GO
;WITH s AS (
  SELECT id, 仓库, 存货编码, 收入数量, 发出数量, 收入金额,
         ROW_NUMBER() OVER (PARTITION BY 仓库, 存货编码 ORDER BY id) AS rn
  FROM v_stock_ledger
), rec AS (
  SELECT rn, 仓库, 存货编码,
         CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,
         CAST(收入金额 AS decimal(38,10)) AS 结存金额,
         CAST(收入数量 AS decimal(38,10)) AS 收入数量,
         CAST(发出数量 AS decimal(38,10)) AS 发出数量,
         CAST(收入金额 AS decimal(38,10)) AS 收入金额
  FROM s WHERE rn = 1
  UNION ALL
  SELECT s.rn, s.仓库, s.存货编码,
         CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),
         CAST(rec.结存金额 + s.收入金额
           - s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10)),
         CAST(s.收入数量 AS decimal(38,10)), CAST(s.发出数量 AS decimal(38,10)), CAST(s.收入金额 AS decimal(38,10))
  FROM rec JOIN s ON s.仓库 = rec.仓库 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1
)
SELECT N'真·移动加权平均' AS 方法, CAST(SUM(结存金额) AS decimal(18,2)) AS 结存金额合计
FROM rec r WHERE r.rn = (SELECT MAX(rn) FROM rec r2 WHERE r2.仓库=r.仓库 AND r2.存货编码=r.存货编码)
OPTION (MAXRECURSION 0);
GO

-- 入库事件数 / 入库单价种数分布(两法差异成因:多入库价分区才会分歧)
SELECT 入库事件数, COUNT(*) AS 分区数 FROM (
  SELECT COUNT(*) AS 入库事件数 FROM v_stock_ledger WHERE 收入数量 > 0
  GROUP BY 仓库, 存货编码) x GROUP BY 入库事件数 ORDER BY 入库事件数;
GO
