-- _q 一次性回填:与 InvCostService.RECURSE 同文本(验证 Java 侧 SQL 可执行 + 补齐存量数据)
-- 正式路径是后端启动自检 / 面板「重算成本」按钮;本脚本仅供本次存量回填与验证。
SET NOCOUNT ON;
DELETE FROM dbo.inv_cost_ledger;
GO
WITH s AS (
 SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,
 ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn
 FROM dbo.v_stock_movement
), rec AS (
 SELECT rn, src, rid, 仓库键, 存货编码, 批号, 单据日期,
 CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,
 CAST(收入金额 - 发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END)
      AS decimal(38,10)) AS 结存金额,
 CAST(发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / 收入数量 ELSE 0 END)
      AS decimal(38,10)) AS 发出成本金额,
 CAST(收入数量 AS decimal(38,10)) AS 收入数量,
 CAST(发出数量 AS decimal(38,10)) AS 发出数量,
 CAST(收入金额 AS decimal(38,10)) AS 收入金额
 FROM s WHERE rn = 1
 UNION ALL
 SELECT s.rn, s.src, s.rid, s.仓库键, s.存货编码, s.批号, s.单据日期,
 CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),
 CAST(rec.结存金额 + s.收入金额
      - s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END)
      AS decimal(38,10)),
 CAST(s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END)
      AS decimal(38,10)),
 CAST(s.收入数量 AS decimal(38,10)),
 CAST(s.发出数量 AS decimal(38,10)),
 CAST(s.收入金额 AS decimal(38,10))
 FROM rec JOIN s ON s.仓库键 = rec.仓库键 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1
)
INSERT INTO dbo.inv_cost_ledger
 (src, rid, 仓库键, 存货编码, 批号, 单据日期, 收入数量, 发出数量, 收入金额,
  结存数量, 移动加权单价, 结存金额, 发出成本金额, 重算时间)
SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期,
 CAST(收入数量 AS decimal(18,4)), CAST(发出数量 AS decimal(18,4)), CAST(收入金额 AS decimal(18,4)),
 CAST(结存数量 AS decimal(18,4)),
 CAST(CASE WHEN 结存数量 <> 0 THEN 结存金额 / 结存数量 ELSE 0 END AS decimal(18,6)),
 CAST(结存金额 AS decimal(18,4)), CAST(发出成本金额 AS decimal(18,4)), SYSDATETIME()
FROM rec
OPTION (MAXRECURSION 0);
GO
SELECT COUNT(*) AS 成本行数 FROM dbo.inv_cost_ledger;
GO
