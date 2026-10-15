-- 新定义:与 migrate-stock-movement-from-flow-2026-09-30.sql 的定义**逐字相同**,
-- 只把两处 `CAST(NULL AS decimal(18,4))`(含税金额/税额)换成对流水表新列的 CAST 透传。
-- ⚠ 两份定义必须一致,改动请同步(那边头部有交叉引用;DbSync 按哈希判重跑,故不能合并成一个文件)。
CREATE VIEW dbo.v_stock_movement AS
SELECT m.src, m.rid, m.单据日期, m.单据类型, m.单据编号, m.业务类型,
       -- 仓库键 = 自身编码 → bs_wh 按名称兜底 → '#'+名称(三级兜底,表达式原样保留)
       ISNULL(ISNULL(m.自身仓库编码, w.仓库编码), N'#' + ISNULL(m.仓库名称, N'(未填仓库)')) AS 仓库键,
       ISNULL(m.自身仓库编码, w.仓库编码) AS 仓库编码,
       ISNULL(m.仓库名称, N'(未填仓库)') AS 仓库,
       m.存货编码, m.存货, m.规格型号, m.计量单位, m.批号,
       m.收入数量, m.发出数量, m.收入金额, m.发出单据金额, m.含税金额, m.税额,
       m.往来单位, m.往来单位编码, m.经手人
FROM (
  -- 入库流水(inh):src 0 期初结存 / 1 采购入库 / 2 产成品入库 / 3 其他入库 / 4 委外入库
  SELECT src,
         -- 期初行 rid 为 NULL ⇒ 用流水行自身 id 作合成键(见任务 4 的「rid 的两处坑」坑1)
         CAST(ISNULL(rid, id) AS int) AS rid,
         CAST(单据日期 AS date) AS 单据日期,
         CAST(单据类型 AS nvarchar(50)) AS 单据类型,
         CAST(单据编号 AS nvarchar(100)) AS 单据编号,
         N'入库' AS 业务类型,
         NULLIF(RTRIM(CAST(仓库编码 AS nvarchar(200))), N'') AS 自身仓库编码,
         CAST(仓库名称 AS nvarchar(200)) AS 仓库名称,
         ISNULL(NULLIF(RTRIM(CAST(物料编码 AS nvarchar(200))), N''), N'(未填存货)') AS 存货编码,
         CAST(物料名称 AS nvarchar(200)) AS 存货,
         CAST(规格型号 AS nvarchar(200)) AS 规格型号,
         CAST(计量单位 AS nvarchar(100)) AS 计量单位,
         ISNULL(NULLIF(RTRIM(CAST(批号 AS nvarchar(60))), N''), N'(未填批号)') AS 批号,
         CAST(数量 AS decimal(18,4)) AS 收入数量,
         CAST(0 AS decimal(18,4)) AS 发出数量,
         CAST(金额 AS decimal(18,4)) AS 收入金额,
         CAST(0 AS decimal(18,4)) AS 发出单据金额,
         -- 任务 7:透传(改前是 CAST(NULL AS decimal(18,4)),故这两列恒 NULL)
         CAST(含税金额 AS decimal(18,4)) AS 含税金额,
         CAST(税额 AS decimal(18,4)) AS 税额,
         CAST(往来单位 AS nvarchar(200)) AS 往来单位,
         CAST(NULL AS nvarchar(200)) AS 往来单位编码,
         CAST(经手人 AS nvarchar(200)) AS 经手人
    FROM dbo.inh WHERE ISNULL(asp_cancel, 'N') <> 'Y'
  UNION ALL
  -- 出库流水(outh):src 5 销售出库 / 6 材料出库 / 7 其他出库 / 8 委外发料
  SELECT src, CAST(ISNULL(rid, id) AS int),
         CAST(单据日期 AS date),
         CAST(单据类型 AS nvarchar(50)),
         CAST(单据编号 AS nvarchar(100)),
         N'出库',
         NULLIF(RTRIM(CAST(仓库编码 AS nvarchar(200))), N''),
         CAST(仓库名称 AS nvarchar(200)),
         ISNULL(NULLIF(RTRIM(CAST(物料编码 AS nvarchar(200))), N''), N'(未填存货)'),
         CAST(物料名称 AS nvarchar(200)),
         CAST(规格型号 AS nvarchar(200)),
         CAST(计量单位 AS nvarchar(100)),
         ISNULL(NULLIF(RTRIM(CAST(批号 AS nvarchar(60))), N''), N'(未填批号)'),
         CAST(0 AS decimal(18,4)),
         CAST(数量 AS decimal(18,4)),
         CAST(0 AS decimal(18,4)),
         CAST(单据金额 AS decimal(18,4)),
         -- 任务 7:透传(同入库段)
         CAST(含税金额 AS decimal(18,4)),
         CAST(税额 AS decimal(18,4)),
         CAST(往来单位 AS nvarchar(200)),
         CAST(NULL AS nvarchar(200)),
         CAST(经手人 AS nvarchar(200))
    FROM dbo.outh WHERE ISNULL(asp_cancel, 'N') <> 'Y'
) m
-- 坑2:必须单行兜底。写成 LEFT JOIN 会因 bs_wh 同名多行把流水行翻倍(实测 62 vs 31)
OUTER APPLY (SELECT TOP 1 x.仓库编码 FROM dbo.bs_wh x WHERE x.仓库名称 = m.仓库名称 ORDER BY x.id) w;