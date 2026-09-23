-- migrate-inv-report-fields.sql — 库存报表三面板:字段补齐 + 出库成本口径修正(移动加权平均)
--
-- 背景(HSDZ_MES 实测 2026-09-21):
--   ① 出库金额取「销售金额」(售价)→ 结存金额 −205,981.28,售价倒挂采购成本,库存价值为负;
--      真·移动加权平均应为 3,099,936.64。
--   ② 仓库维度靠「名称」关联 bs_wh,名称 29+15 行为空 → 84 行 balance 中 8 行仓库空白;
--      bl_purchase_in/bl_sale_out 本就带 仓库编码(114/149、123/123),未用。
--   ③ 批号在 8 张行表都有(采购 109/149、销售 110/123),但三视图全未取用 → 无法按批次追溯。
--   ④ bl_purchase_in.金额 29 行为 NULL;而 单价 149/149、售价 123/123 全有值 → 可 100% 兜底。
--   ⑤ v_stock_summary.辅单位 恒为 NULL(源列 计量单位2 仅 2 行)→ 死列。
--
-- 为何要「物化成本表 + 存储过程」:
--   真·移动加权平均本质是递归(无闭式解)。递归 CTE 可以建视图,但**视图不能带
--   OPTION (MAXRECURSION)**,走默认 100 行上限;台账 235 行 → 直接报「用完最大递归 100」。
--   累计入库加权平均虽可进视图,但口径不同:实测 2,268,221.49 vs 真值 3,092,184.28(差 27%),
--   不可当近似互换。故成本必须由存储过程(可用 MAXRECURSION 0)算入物化表。
--
-- 分区键的实测抉择(本脚本的关键设计):
--   移动加权的分区键取 **(仓库键, 存货编码)**,**不含批号**。实测:
--     存货级 78 分区 / 27 个「只出无进」 / 39 个负结存;
--     批次级 225 分区 / **114 个「只出无进」(51%)** / 115 个负结存。
--   批号进分区键会让一半分区没有入库 → 出库成本恒 0、结存数量为负,报表不可用。
--   根因不是销售批号为空(空批号销售仅 13 行,其中只有 1 行的存货本有入库),
--   而是同一个批号值在采购侧与销售侧挂到了不同的 (仓库,存货) 组合上。
--   → 批号只作**台账明细列**(逐行属性,不做聚合/分组),不进 balance/summary 的 GROUP BY。
--
-- 保留的既有契约(改对会静默改坏 Java,勿动):
--   v_stock_ledger 的列名 仓库/存货/单据日期/收入数量/发出数量/收入金额/发出金额
--     — QueryService.queryFlat 的三段式(期初/期末合成行)按名取值,且其开账 SQL 用
--       「收入金额 − 发出金额」「收入数量 − 发出数量」;发出金额改成成本后自动一致,Java 不动。
--   v_stock_balance/v_stock_summary 的 id/asp_cancel 列。
SET NOCOUNT ON;

-- ══ 0) 卸载依赖视图(重建顺序:movement → 成本表 → 存储过程 → ledger → summary → balance) ══
IF OBJECT_ID('dbo.v_stock_summary')  IS NOT NULL DROP VIEW dbo.v_stock_summary;
IF OBJECT_ID('dbo.v_stock_balance')  IS NOT NULL DROP VIEW dbo.v_stock_balance;
IF OBJECT_ID('dbo.v_stock_ledger')   IS NOT NULL DROP VIEW dbo.v_stock_ledger;
IF OBJECT_ID('dbo.v_stock_movement') IS NOT NULL DROP VIEW dbo.v_stock_movement;
GO

-- 单据状态2(金蝶同步列)由已删除的数据装载脚本创建,DDL 未入链——此处幂等补列,保证链可重放
IF COL_LENGTH('dbo.bd_purchase_in', N'单据状态2') IS NULL ALTER TABLE bd_purchase_in ADD [单据状态2] nvarchar(20) NULL;
IF COL_LENGTH('dbo.bd_sale_out',    N'单据状态2') IS NULL ALTER TABLE bd_sale_out    ADD [单据状态2] nvarchar(20) NULL;
GO

-- ══ 1) v_stock_movement —— 8 类出入库单据行的**唯一** UNION 处 ══
-- 此前 v_stock_balance 与 v_stock_ledger 各自复制了一份 8 路 UNION,口径漂移无单一真源;
-- 自此二者(及成本过程)都只读本视图。
--
-- 命名差异(实测,sys.columns 核对):数量列 采购/产成品/委外入库 = 实收数量,其余 5 类 = 数量;
--   存货列 采购/销售/其他出入库 = 存货编码|存货名称,产成品/委外入库 = 产品编码|产品名称,
--   材料出库/委外发料 = 材料编码|材料名称;含税金额 采购入库 = 含税金额、销售出库 = 含税销售金额;
--   税额 仅销售出库有列,采购入库按 含税金额 − 金额 反推;仓库编码 仅采购入库/销售出库有列。
GO
EXEC(N'
CREATE VIEW dbo.v_stock_movement AS
WITH mv AS (
  -- 1 采购入库单(入库 +)
  SELECT 1 AS src, l.id AS rid, h.单据日期, N''采购入库单'' AS 单据类型, l.单据编号, N''入库'' AS 业务类型,
         l.仓库 AS 仓库名称, NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N'''') AS 自身仓库编码,
         ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''''), N''(未填存货)'') AS 存货编码,
         l.存货名称 AS 存货, l.规格型号, l.计量单位,
         ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''''), N''(未填批号)'') AS 批号,
         CAST(l.实收数量 AS decimal(18,4)) AS 收入数量, CAST(0 AS decimal(18,4)) AS 发出数量,
         CAST(ISNULL(l.金额, l.单价 * l.实收数量) AS decimal(18,4)) AS 收入金额,
         CAST(0 AS decimal(18,4)) AS 发出单据金额,
         CAST(l.含税金额 AS decimal(18,4)) AS 含税金额,
         CAST(l.含税金额 - ISNULL(l.金额, l.单价 * l.实收数量) AS decimal(18,4)) AS 税额,
         h.供应商 AS 往来单位, NULLIF(RTRIM(CAST(h.供应商编码 AS nvarchar(200))),N'''') AS 往来单位编码,
         h.经手人 AS 经手人
  FROM bl_purchase_in l JOIN bd_purchase_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
    AND (h.单据状态=N''已审核'' OR ISNULL(h.单据状态2,'''')=''C'')
  UNION ALL
  -- 2 产成品入库单(入库 +)
  SELECT 2, l.id, h.单据日期, N''产成品入库单'', l.单据编号, N''入库'',
         l.仓库, NULL,
         ISNULL(NULLIF(RTRIM(CAST(l.产品编码 AS nvarchar(200))),N''''), N''(未填存货)''),
         l.产品名称, l.规格型号, l.计量单位,
         ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''''), N''(未填批号)''),
         CAST(l.实收数量 AS decimal(18,4)), CAST(0 AS decimal(18,4)),
         CAST(ISNULL(l.金额, l.单价 * l.实收数量) AS decimal(18,4)),
         CAST(0 AS decimal(18,4)),
         NULL, NULL,
         NULL, NULL, h.经手人
  FROM bl_finish_in l JOIN bd_finish_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  -- 3 其他入库单(入库 +);bd_other_in 无 经手人 列 → NULL
  SELECT 3, l.id, h.单据日期, N''其他入库单'', l.单据编号, N''入库'',
         l.仓库, NULL,
         ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''''), N''(未填存货)''),
         l.存货名称, l.规格型号, l.计量单位,
         ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''''), N''(未填批号)''),
         CAST(l.数量 AS decimal(18,4)), CAST(0 AS decimal(18,4)),
         CAST(ISNULL(l.金额, l.单价 * l.数量) AS decimal(18,4)),
         CAST(0 AS decimal(18,4)),
         NULL, NULL,
         NULL, NULL, NULL
  FROM bl_other_in l JOIN bd_other_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  -- 4 委外入库单(入库 +)
  SELECT 4, l.id, h.单据日期, N''委外入库单'', l.单据编号, N''入库'',
         l.仓库, NULL,
         ISNULL(NULLIF(RTRIM(CAST(l.产品编码 AS nvarchar(200))),N''''), N''(未填存货)''),
         l.产品名称, l.规格型号, l.计量单位,
         ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''''), N''(未填批号)''),
         CAST(l.实收数量 AS decimal(18,4)), CAST(0 AS decimal(18,4)),
         CAST(ISNULL(l.金额, l.单价 * l.实收数量) AS decimal(18,4)),
         CAST(0 AS decimal(18,4)),
         NULL, NULL,
         NULL, NULL, h.经手人
  FROM bl_outsource_in l JOIN bd_outsource_in h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  -- 5 销售出库单(出库 −):收入金额 0,售价金额单列(成本由物化表给)
  SELECT 5, l.id, h.单据日期, N''销售出库单'', l.单据编号, N''出库'',
         l.仓库, NULLIF(RTRIM(CAST(l.仓库编码 AS nvarchar(200))),N''''),
         ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''''), N''(未填存货)''),
         l.存货名称, l.规格型号, l.计量单位,
         ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''''), N''(未填批号)''),
         CAST(0 AS decimal(18,4)), CAST(l.数量 AS decimal(18,4)),
         CAST(0 AS decimal(18,4)),
         CAST(ISNULL(l.销售金额, l.售价 * l.数量) AS decimal(18,4)),
         CAST(l.含税销售金额 AS decimal(18,4)), CAST(l.税额 AS decimal(18,4)),
         h.客户, NULLIF(RTRIM(CAST(h.客户编码 AS nvarchar(200))),N''''), h.经手人
  FROM bl_sale_out l JOIN bd_sale_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y''
    AND (h.单据状态=N''已审核'' OR ISNULL(h.单据状态2,'''')=''C'')
  UNION ALL
  -- 6 材料出库单(出库 −);bd_material_out 无 经手人 列(有 领用人,语义不同)→ NULL
  SELECT 6, l.id, h.单据日期, N''材料出库单'', l.单据编号, N''出库'',
         l.仓库, NULL,
         ISNULL(NULLIF(RTRIM(CAST(l.材料编码 AS nvarchar(200))),N''''), N''(未填存货)''),
         l.材料名称, l.规格型号, l.计量单位,
         ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''''), N''(未填批号)''),
         CAST(0 AS decimal(18,4)), CAST(l.数量 AS decimal(18,4)),
         CAST(0 AS decimal(18,4)),
         CAST(ISNULL(l.金额, l.单价 * l.数量) AS decimal(18,4)),
         NULL, NULL,
         NULL, NULL, NULL
  FROM bl_material_out l JOIN bd_material_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  -- 7 其他出库单(出库 −)
  SELECT 7, l.id, h.单据日期, N''其他出库单'', l.单据编号, N''出库'',
         l.仓库, NULL,
         ISNULL(NULLIF(RTRIM(CAST(l.存货编码 AS nvarchar(200))),N''''), N''(未填存货)''),
         l.存货名称, l.规格型号, l.计量单位,
         ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''''), N''(未填批号)''),
         CAST(0 AS decimal(18,4)), CAST(l.数量 AS decimal(18,4)),
         CAST(0 AS decimal(18,4)),
         CAST(ISNULL(l.金额, l.单价 * l.数量) AS decimal(18,4)),
         NULL, NULL,
         NULL, NULL, h.经手人
  FROM bl_other_out l JOIN bd_other_out h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
  UNION ALL
  -- 8 委外发料单(出库 −)
  SELECT 8, l.id, h.单据日期, N''委外发料单'', l.单据编号, N''出库'',
         l.仓库, NULL,
         ISNULL(NULLIF(RTRIM(CAST(l.材料编码 AS nvarchar(200))),N''''), N''(未填存货)''),
         l.材料名称, l.规格型号, l.计量单位,
         ISNULL(NULLIF(RTRIM(CAST(l.批号 AS nvarchar(60))),N''''), N''(未填批号)''),
         CAST(0 AS decimal(18,4)), CAST(l.数量 AS decimal(18,4)),
         CAST(0 AS decimal(18,4)),
         CAST(ISNULL(l.金额, l.单价 * l.数量) AS decimal(18,4)),
         NULL, NULL,
         NULL, NULL, h.经手人
  FROM bl_outsource_issue l JOIN bd_outsource_issue h ON l.单据编号=h.单据编号
  WHERE ISNULL(l.asp_cancel,''N'')<>''Y'' AND ISNULL(h.asp_cancel,''N'')<>''Y'' AND h.单据状态=N''已审核''
)
SELECT m.src, m.rid, m.单据日期, m.单据类型, m.单据编号, m.业务类型,
       -- 仓库键 = 自身编码 → bs_wh 按名称兜底 → ''#''+名称(都无时)
       -- 兜底是必须的:否则「有编码的行」与「只有名称的行」会落进不同分区,同一仓库被劈成两半
       -- (实测:不兜底 92 分区,兜底后 78 分区,与按名称分组的 78 一致 → 兜底没有劈开也没有误并)
       ISNULL(ISNULL(m.自身仓库编码, w.仓库编码), N''#'' + ISNULL(m.仓库名称, N''(未填仓库)'')) AS 仓库键,
       ISNULL(m.自身仓库编码, w.仓库编码) AS 仓库编码,
       ISNULL(m.仓库名称, N''(未填仓库)'') AS 仓库,
       m.存货编码, m.存货, m.规格型号, m.计量单位, m.批号,
       m.收入数量, m.发出数量, m.收入金额, m.发出单据金额, m.含税金额, m.税额,
       m.往来单位, m.往来单位编码, m.经手人
FROM mv m LEFT JOIN dbo.bs_wh w ON w.仓库名称 = m.仓库名称;
');
GO

-- ══ 2) inv_cost_ledger —— 物化成本表(每张行表行一行,故 PK (src, rid) 稳定) ══
IF OBJECT_ID('dbo.inv_cost_ledger') IS NULL
CREATE TABLE dbo.inv_cost_ledger (
  src          int           NOT NULL,   -- 单据类型 1..8,与 v_stock_movement.src 同
  rid          int           NOT NULL,   -- 行表 id
  仓库键       nvarchar(450) NOT NULL,
  存货编码     nvarchar(200) NOT NULL,
  批号         nvarchar(60)  NOT NULL,
  单据日期     date          NULL,
  收入数量     decimal(18,4) NOT NULL CONSTRAINT DF_inv_cost_ledger_收入数量 DEFAULT (0),
  发出数量     decimal(18,4) NOT NULL CONSTRAINT DF_inv_cost_ledger_发出数量 DEFAULT (0),
  收入金额     decimal(18,4) NOT NULL CONSTRAINT DF_inv_cost_ledger_收入金额 DEFAULT (0),
  结存数量     decimal(18,4) NOT NULL CONSTRAINT DF_inv_cost_ledger_结存数量 DEFAULT (0),
  移动加权单价 decimal(18,6) NOT NULL CONSTRAINT DF_inv_cost_ledger_单价     DEFAULT (0),
  结存金额     decimal(18,4) NOT NULL CONSTRAINT DF_inv_cost_ledger_结存金额 DEFAULT (0),
  发出成本金额 decimal(18,4) NOT NULL CONSTRAINT DF_inv_cost_ledger_发出成本 DEFAULT (0),
  重算时间     datetime2(0)  NOT NULL CONSTRAINT DF_inv_cost_ledger_重算时间 DEFAULT (SYSDATETIME()),
  CONSTRAINT PK_inv_cost_ledger PRIMARY KEY CLUSTERED (src, rid)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_inv_cost_ledger_part' AND object_id=OBJECT_ID('dbo.inv_cost_ledger'))
  CREATE INDEX IX_inv_cost_ledger_part ON dbo.inv_cost_ledger (仓库键, 存货编码) INCLUDE (结存数量, 结存金额, 发出成本金额, 移动加权单价);
GO

-- ══ 3) 成本重算不在本脚本内 —— 由 Java 侧 InvCostService 负责 ══
-- 曾设计为存储过程 sp_recalc_inv_cost,实测行不通:迁移以 yinjia 执行,而 yinjia 只是
-- db_ddladmin/db_datareader/db_datawriter(非 db_owner)。在 dbo 架构下建的对象归 dbo 所有,
-- 于是 yinjia 既不能 EXECUTE,也无权 GRANT EXECUTE → 运行期审核钩子会直接报权限错误。
-- (仓库既有约定 `IF USER_NAME() <> 'yinjia' GRANT ...` 亦印证迁移预期以更高权限账号部署。)
-- Java 侧用 JdbcTemplate 直接跑同一个递归 CTE 并带 OPTION (MAXRECURSION 0) —— 该查询提示
-- 只是语句的一部分,不需要任何额外权限,故运行期与部署环境都成立。
-- 逻辑唯一实现处:backend/.../service/InvCostService.java(重算范围与分区口径须与下方注释一致):
--   分区 = (仓库键, 存货编码),**不含批号** —— 批号进分区会让 51% 的分区没有入库(实测,见文件头);
--   单价规则 = 出库按**出库前**的移动加权单价计价(结存金额/结存数量;除零则 0)。
IF OBJECT_ID('dbo.sp_recalc_inv_cost','P') IS NOT NULL DROP PROCEDURE dbo.sp_recalc_inv_cost;  -- 清掉试做期的残留
GO
-- (本脚本不预填 inv_cost_ledger:全新库此时无单据,填了也是空;存量数据的重算见文件尾「存量回填」)
GO

-- ══ 4) v_stock_ledger —— 行级流水 + 移动加权成本(期初/期末取自物化表,不再用窗口累计) ══
-- 期初 = 本行结存 − 本行收入 + 本行发出(即本行发生前的状态);期末 = 本行结存。
-- 这样在日期段过滤下语义自动正确:区间首行期初 = 期初结存,区间末行期末 = 期末结存
-- (窗口函数版靠「窗口在 WHERE 前计算」实现同一效果,现改为物化值,不再依赖执行顺序)。
GO
EXEC(N'
CREATE VIEW dbo.v_stock_ledger AS
SELECT ROW_NUMBER() OVER (ORDER BY m.仓库键, m.存货编码, m.单据日期, m.src, m.rid) AS id,
       CONVERT(nvarchar(10), m.单据日期, 120) AS 开始日期,
       CONVERT(nvarchar(10), m.单据日期, 120) AS 结束日期,
       m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.计量单位, m.批号,
       m.单据日期, m.单据类型, m.单据编号, m.业务类型, m.往来单位, m.往来单位编码, m.经手人,
       ISNULL(c.结存数量,0) - m.收入数量 + m.发出数量 AS 期初数量,
       CASE WHEN ISNULL(c.结存数量,0) - m.收入数量 + m.发出数量 <> 0
            THEN (ISNULL(c.结存金额,0) - m.收入金额 + ISNULL(c.发出成本金额,0))
                 / (ISNULL(c.结存数量,0) - m.收入数量 + m.发出数量)
            ELSE 0 END AS 期初平均单价,
       ISNULL(c.结存金额,0) - m.收入金额 + ISNULL(c.发出成本金额,0) AS 期初金额,
       m.收入数量,
       CASE WHEN m.收入数量<>0 THEN m.收入金额/m.收入数量 ELSE 0 END AS 收入单价,
       m.收入金额,
       m.含税金额, m.税额,
       m.发出数量,
       CASE WHEN m.发出数量<>0 THEN ISNULL(c.发出成本金额,0)/m.发出数量 ELSE 0 END AS 发出单价,
       ISNULL(c.发出成本金额,0) AS 发出金额,
       m.发出单据金额,
       ISNULL(c.结存数量,0) AS 期末数量,
       ISNULL(c.移动加权单价,0) AS 期末平均单价,
       ISNULL(c.结存金额,0) AS 期末金额,
       CAST(''N'' AS char(1)) AS asp_cancel
FROM dbo.v_stock_movement m
LEFT JOIN dbo.inv_cost_ledger c ON c.src = m.src AND c.rid = m.rid;
');
GO

-- ══ 5) v_stock_summary —— 按 仓库+存货+期次 聚合(删死列「辅单位」;批号不进 GROUP BY,见文件头) ══
GO
EXEC(N'
CREATE VIEW dbo.v_stock_summary AS
WITH monthly AS (
  SELECT 仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位 AS 主单位,
         ISNULL(CONVERT(nvarchar(7), 单据日期, 120), N''未填日期'') AS 期次,
         SUM(收入数量) AS 本期入库数量, SUM(收入金额) AS 本期入库金额,
         SUM(发出数量) AS 本期出库数量, SUM(发出金额) AS 本期出库金额
  FROM dbo.v_stock_ledger
  GROUP BY 仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位,
           ISNULL(CONVERT(nvarchar(7), 单据日期, 120), N''未填日期'')
),
run AS (
  SELECT monthly.*,
         SUM(本期入库数量 - 本期出库数量) OVER (PARTITION BY 仓库编码, 仓库, 存货编码, 存货
              ORDER BY 期次 ROWS UNBOUNDED PRECEDING) AS 期末结存数量,
         SUM(本期入库金额 - 本期出库金额) OVER (PARTITION BY 仓库编码, 仓库, 存货编码, 存货
              ORDER BY 期次 ROWS UNBOUNDED PRECEDING) AS 期末结存金额
  FROM monthly
),
calc AS (
  SELECT *, 期末结存数量 - (本期入库数量 - 本期出库数量) AS 期初数量,
            期末结存金额 - (本期入库金额 - 本期出库金额) AS 期初金额
  FROM run
)
SELECT ROW_NUMBER() OVER (ORDER BY 仓库, 存货编码, 期次) AS id,
       CASE WHEN 期次 LIKE ''[0-9][0-9][0-9][0-9]-[0-9][0-9]'' THEN 期次 + ''-01'' END AS 开始日期,
       CASE WHEN 期次 LIKE ''[0-9][0-9][0-9][0-9]-[0-9][0-9]''
            THEN CONVERT(nvarchar(10), DATEADD(DAY, -1, DATEADD(MONTH, 1, 期次 + ''-01'')), 120) END AS 结束日期,
       仓库编码, 仓库, 存货编码, 存货, 规格型号, 主单位, 期次,
       期初数量, CASE WHEN 期初数量<>0 THEN 期初金额/期初数量 ELSE 0 END AS 期初平均单价, 期初金额,
       本期入库数量, CASE WHEN 本期入库数量<>0 THEN 本期入库金额/本期入库数量 ELSE 0 END AS 入库平均单价, 本期入库金额,
       本期出库数量, CASE WHEN 本期出库数量<>0 THEN 本期出库金额/本期出库数量 ELSE 0 END AS 出库平均单价, 本期出库金额,
       期末结存数量, CASE WHEN 期末结存数量<>0 THEN 期末结存金额/期末结存数量 ELSE 0 END AS 期末平均单价, 期末结存金额,
       CAST(''N'' AS char(1)) AS asp_cancel
FROM calc;
');
GO

-- ══ 6) v_stock_balance —— 现存量 + 移动加权结存金额(结存金额 = Σ收入金额 − Σ发出成本,按分区聚合) ══
-- 结存金额取「分区内最后一行结存金额」= Σ(收入金额 − 发出成本),二者恒等,故用聚合写法(可 SQL 直接算)。
GO
EXEC(N'
CREATE VIEW dbo.v_stock_balance AS
SELECT ROW_NUMBER() OVER (ORDER BY m.仓库, m.存货编码, m.存货) AS id,
       m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量,
       SUM(m.数量*m.sign) AS 现存量,
       CASE WHEN SUM(m.数量*m.sign)<>0 THEN SUM(m.金额*m.sign)/SUM(m.数量*m.sign) ELSE 0 END AS 结存单价,
       SUM(m.金额*m.sign) AS 结存金额,
       CAST(''N'' AS char(1)) AS asp_cancel
FROM (
  -- 在库:现存量按 仓库键+存货 聚合;金额 = 收入金额 − 移动加权发出成本(取自物化表)
  SELECT m.仓库键, m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.计量单位 AS 主计量,
         m.收入数量 - m.发出数量 AS 数量,
         m.收入金额 - ISNULL(c.发出成本金额,0) AS 金额, 1 AS sign
  FROM dbo.v_stock_movement m
  LEFT JOIN dbo.inv_cost_ledger c ON c.src = m.src AND c.rid = m.rid
) m
-- 与成本分区键同口径(含 仓库键):否则同编码不同名称写法会被拆成两行,与成本口径不一致
GROUP BY m.仓库键, m.仓库编码, m.仓库, m.存货编码, m.存货, m.规格型号, m.主计量;
');
GO

-- ══ 7) 存量回填 —— 本脚本不做,由后端「重算成本」按钮 / 首次审核触发 ══
-- 新库此时无单据,填了也是空;存量数据(本机 HSDZ_MES 272 行流水)需要在部署后跑一次:
--   面板「库存台账」→ 工具栏「重算成本」,或审核任意一张出入库单即触发全量重算。
-- 自检若发现「无成本行的流水 > 0」即为尚未回填,按上述任一方式补齐。
GO

-- ══ 8) 面板字段:库存台账新增 6 列(detail);收发存汇总表删死列「辅单位」 ══
-- 批号/往来单位编码/经手人/含税金额/税额/发出单据金额 只加在**台账**(行级面板,逐行属性都成立);
-- 不加在 状况表/汇总表:这三者要按 (仓库,存货) 聚合,往来单位/经手人是单据属性、
-- 聚合后会变成 MAX(混合值) 误导;批号进 GROUP BY 则如文件头所测(51% 分区只出无进)不可用。
-- 「发出单据金额」是**防止信息丢失**:改口径前 发出金额 就是 销售金额,改后变成成本,
-- 不单列售价金额则用户今天能看到的销售额会凭空消失。
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible, col_group)
SELECT v.panel_code, v.col_name, v.label, v.data_type, v.place, v.seq, v.width, 0, 0, 0, 1, v.col_group
FROM (VALUES
  ('STOCK_LEDGER', N'批号',         N'批号',         N'文本', N'detail',  65,  110, CAST(NULL AS nvarchar(50))),
  ('STOCK_LEDGER', N'往来单位编码', N'往来单位编码', N'文本', N'detail', 115,  120, NULL),
  ('STOCK_LEDGER', N'经手人',       N'经手人',       N'文本', N'detail', 116,  100, NULL),
  ('STOCK_LEDGER', N'含税金额',     N'含税金额',     N'小数', N'detail', 145,  110, N'收入'),
  ('STOCK_LEDGER', N'税额',         N'税额',         N'小数', N'detail', 146,  100, N'收入'),
  ('STOCK_LEDGER', N'发出单据金额', N'发出单据金额', N'小数', N'detail', 175,  110, N'发出')
) AS v(panel_code, col_name, label, data_type, place, seq, width, col_group)
WHERE NOT EXISTS (SELECT 1 FROM yj_field f
                  WHERE f.panel_code = v.panel_code AND f.col_name = v.col_name);

DELETE FROM yj_field WHERE panel_code='STOCK_SUMMARY' AND col_name=N'辅单位';
GO

-- ══ 9) 译名(en) ══
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'批号' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'批号', 'en', N'Lot No.', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'往来单位编码' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'往来单位编码', 'en', N'Partner Code', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'经手人' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'经手人', 'en', N'Handler', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'含税金额' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'含税金额', 'en', N'Amount incl. Tax', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税额' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税额', 'en', N'Tax Amount', 'manual');
IF NOT EXISTS(SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'发出单据金额' AND locale='en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'发出单据金额', 'en', N'Issue Doc Amount', 'manual');
GO

-- ══ 10) 视图注明 ══
IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.v_stock_movement') AND name='MS_Description')
  EXEC sp_dropextendedproperty N'MS_Description', N'schema',N'dbo',N'view',N'v_stock_movement';
EXEC sp_addextendedproperty N'MS_Description',
     N'库存流水:8类出入库单据行的唯一UNION处(仅已审核)。仓库键=自身编码→bs_wh按名称兜底→#名称;批号空值归(未填批号);金额缺失按 单价×数量 兜底',
     N'schema',N'dbo',N'view',N'v_stock_movement';
IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.v_stock_ledger') AND name='MS_Description')
  EXEC sp_dropextendedproperty N'MS_Description', N'schema',N'dbo',N'view',N'v_stock_ledger';
EXEC sp_addextendedproperty N'MS_Description',
     N'库存台账:行级流水,收入按单据金额、发出按移动加权成本(读 inv_cost_ledger);期初=本行结存−收入+发出,期末=本行结存',
     N'schema',N'dbo',N'view',N'v_stock_ledger';
IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.v_stock_summary') AND name='MS_Description')
  EXEC sp_dropextendedproperty N'MS_Description', N'schema',N'dbo',N'view',N'v_stock_summary';
EXEC sp_addextendedproperty N'MS_Description',
     N'收发存汇总表:台账按仓库+存货+期次(yyyy-MM)聚合;出库金额为移动加权成本(非售价)',
     N'schema',N'dbo',N'view',N'v_stock_summary';
IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.v_stock_balance') AND name='MS_Description')
  EXEC sp_dropextendedproperty N'MS_Description', N'schema',N'dbo',N'view',N'v_stock_balance';
EXEC sp_addextendedproperty N'MS_Description',
     N'库存状况表:按仓库+存货聚合现存量;结存金额=Σ收入金额−Σ移动加权发出成本(非售价)',
     N'schema',N'dbo',N'view',N'v_stock_balance';
IF EXISTS(SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID('dbo.inv_cost_ledger') AND name='MS_Description')
  EXEC sp_dropextendedproperty N'MS_Description', N'schema',N'dbo',N'table',N'inv_cost_ledger';
EXEC sp_addextendedproperty N'MS_Description',
     N'库存移动加权成本物化表:由后端 InvCostService 重算(审核/弃审钩子 + 启动自检 + 面板「重算成本」),分区=(仓库键,存货编码)不含批号;PK (src,rid) 对应 v_stock_movement 一行',
     N'schema',N'dbo',N'table',N'inv_cost_ledger';
GO

-- ══ 自检 ══
SELECT (SELECT COUNT(*) FROM v_stock_movement) AS 流水行数,
       (SELECT COUNT(*) FROM inv_cost_ledger)  AS 成本行数,
       (SELECT COUNT(*) FROM v_stock_ledger)   AS 台账行数,
       (SELECT COUNT(*) FROM v_stock_summary)  AS 汇总行数,
       (SELECT COUNT(*) FROM v_stock_balance)  AS 状况行数;
GO
-- 成本覆盖:应为 0 行(每条流水都要有成本行)
SELECT COUNT(*) AS 无成本行的流水 FROM v_stock_movement m
LEFT JOIN inv_cost_ledger c ON c.src=m.src AND c.rid=m.rid WHERE c.src IS NULL;
GO
-- 口径核对:结存金额 = Σ收入金额 − Σ发出成本;并给出新旧口径对比
SELECT CAST(SUM(收入金额) AS decimal(18,2)) AS 累计入库金额,
       CAST(SUM(发出金额) AS decimal(18,2)) AS 累计出库成本,
       CAST(SUM(收入金额-发出金额) AS decimal(18,2)) AS 结存金额合计,
       CAST(SUM(发出单据金额) AS decimal(18,2)) AS 累计发出单据金额,
       CAST(SUM(收入金额-发出单据金额) AS decimal(18,2)) AS 旧售价口径结存金额
FROM v_stock_ledger;
GO
-- 逐行勾稽:期初+收入−发出=期末 必须全部成立
SELECT COUNT(*) AS 勾稽不符行数 FROM v_stock_ledger
WHERE ABS((期初数量+收入数量-发出数量)-期末数量) > 0.0001;
GO
-- 批次级健康度(说明批号为何不能进 GROUP BY):分区数 / 只出无进 / 负结存
SELECT N'存货级(仓库,存货)' AS 口径, COUNT(*) AS 分区数,
       SUM(CASE WHEN 入=0 AND 出>0 THEN 1 ELSE 0 END) AS 只出无进
FROM (SELECT 仓库键, 存货编码, SUM(收入数量) AS 入, SUM(发出数量) AS 出
      FROM v_stock_movement GROUP BY 仓库键, 存货编码) a
UNION ALL
SELECT N'批次级(+批号)', COUNT(*), SUM(CASE WHEN 入=0 AND 出>0 THEN 1 ELSE 0 END)
FROM (SELECT 仓库键, 存货编码, 批号, SUM(收入数量) AS 入, SUM(发出数量) AS 出
      FROM v_stock_movement GROUP BY 仓库键, 存货编码, 批号) b;
GO
-- 面板字段自检:台账 6 个新列在场、汇总表无「辅单位」
SELECT (SELECT COUNT(*) FROM yj_field WHERE panel_code='STOCK_LEDGER'
        AND col_name IN (N'批号',N'往来单位编码',N'经手人',N'含税金额',N'税额',N'发出单据金额')) AS 台账新列数,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code='STOCK_SUMMARY' AND col_name=N'辅单位') AS 汇总表辅单位残留,
       (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND locale='en'
        AND ref_key IN (N'批号',N'往来单位编码',N'经手人',N'含税金额',N'税额',N'发出单据金额')) AS 新译名数;
GO
PRINT N'库存报表三面板字段补齐 + 移动加权成本口径完成';
GO
