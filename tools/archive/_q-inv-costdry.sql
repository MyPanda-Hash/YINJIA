-- _q-inv-costdry.sql — 迁移前彩排:以最终分区键(兜底编码, 存货)跑真·移动加权平均
-- 验证:分区健康度、结存金额合计、是否存在负结存金额分区
SET NOCOUNT ON;

;WITH mov AS (
  SELECT ISNULL(ISNULL(NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N''), w.仓库编码),
                N'#' + ISNULL(NULLIF(RTRIM(CAST(l.仓库 AS nvarchar(200))),N''), N'(未填仓库)')) AS 仓库键,
         ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''), N'(未填存货)') AS 存货编码,
         h.单据日期,
         CAST(l.实收数量 AS decimal(18,4)) AS 收入数量, CAST(0 AS decimal(18,4)) AS 发出数量,
         CAST(ISNULL(l.金额, l.单价 * l.实收数量) AS decimal(18,4)) AS 收入金额,
         1 AS src, l.id AS rid
  FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
  LEFT JOIN dbo.bs_wh w ON w.仓库名称 = l.仓库
  WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
    AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C')
  UNION ALL
  SELECT ISNULL(ISNULL(NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N''), w.仓库编码),
                N'#' + ISNULL(NULLIF(RTRIM(CAST(l.仓库 AS nvarchar(200))),N''), N'(未填仓库)')),
         ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''), N'(未填存货)'),
         h.单据日期,
         CAST(0 AS decimal(18,4)), CAST(l.数量 AS decimal(18,4)), CAST(0 AS decimal(18,4)),
         5, l.id
  FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
  LEFT JOIN dbo.bs_wh w ON w.仓库名称 = l.仓库
  WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.asp_cancel,'N')<>'Y'
    AND (h.单据状态=N'已审核' OR ISNULL(h.单据状态2,'')='C')
),
s AS (SELECT mov.*, ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn FROM mov),
rec AS (
  SELECT rn, 仓库键, 存货编码,
         CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,
         CAST(收入金额 - 发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / NULLIF(收入数量,0) ELSE 0 END) AS decimal(38,10)) AS 结存金额,
         CAST(发出数量 * (CASE WHEN 收入数量 <> 0 THEN 收入金额 / NULLIF(收入数量,0) ELSE 0 END) AS decimal(38,10)) AS 发出成本,
         CAST(收入金额 AS decimal(38,10)) AS 收入金额,
         CAST(发出数量 AS decimal(38,10)) AS 发出数量
  FROM s WHERE rn = 1
  UNION ALL
  SELECT s.rn, s.仓库键, s.存货编码,
         CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),
         CAST(rec.结存金额 + s.收入金额
              - s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10)),
         CAST(s.发出数量 * (CASE WHEN rec.结存数量 <> 0 THEN rec.结存金额 / rec.结存数量 ELSE 0 END) AS decimal(38,10)),
         CAST(s.收入金额 AS decimal(38,10)),
         CAST(s.发出数量 AS decimal(38,10))
  FROM rec JOIN s ON s.仓库键 = rec.仓库键 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1
),
tot AS (
  SELECT 仓库键, 存货编码,
         SUM(收入金额) AS 收入金额合计, SUM(发出成本) AS 发出成本合计,
         SUM(发出数量) AS 发出数量合计
  FROM rec GROUP BY 仓库键, 存货编码)
SELECT COUNT(*) AS 分区数,
       SUM(CASE WHEN 收入金额合计 = 0 AND 发出数量合计 > 0 THEN 1 ELSE 0 END) AS 只出无进分区,
       CAST(SUM(收入金额合计) AS decimal(18,2)) AS 累计入库金额,
       CAST(SUM(发出成本合计) AS decimal(18,2)) AS 累计出库成本,
       CAST(SUM(收入金额合计 - 发出成本合计) AS decimal(18,2)) AS 结存金额合计
FROM tot
OPTION (MAXRECURSION 0);
GO
