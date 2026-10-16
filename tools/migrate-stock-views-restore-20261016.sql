/* migrate-stock-views-restore-20261016.sql — 恢复并修正 v_stock_ledger / v_stock_summary(事故修复)
 *
 * 【事故】2026-10-16 修「收发存汇总期次」时改了 canonical 脚本 migrate-inv-accounting.sql 的字节,
 *   DbSync 按内容哈希判定"需重跑"⇒ 该脚本开头 DROP VIEW v_stock_summary / v_stock_ledger 已执行,
 *   随后它引用的 l_outsource_in **已被 2026-10-16 下架迁移删除** ⇒ 「对象名无效」中止:
 *   **两张视图在两个账套里都消失了**(面板直接报错)。这正是 AGENTS.md G12「下架类迁移 + 旧脚本重跑」的同类事故。
 *
 * 【修法】canonical 脚本字节**不动**(保持与 yj_schema_log 一致,不再触发重跑);
 *   本脚本按**清单里最后生效的定义**(migrate-inv-report-fields.sql,清单第 997 行)重建两张视图,并:
 *     ① **摘掉已下架表的「委外入库单」分支**(bl_outsource_in/bd_outsource_in,下架后该分支本该消失);
 *     ② 期次桶收敛:空 = 未填日期 / < 2020-01-01 = 期初 / > 今天 = 日期异常 / 其余 = yyyy-MM
 *        (实测未来期次来自单张 XSCK-20270901-00001(2027-09-01),会让「最新期次」误取到它)。
 *   ⚠ 不改业务数据。
 * 幂等:CREATE OR ALTER VIEW;两账套都执行。
 */
SET NOCOUNT ON;
GO
CREATE OR ALTER VIEW dbo.v_stock_ledger AS
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
       CAST('N' AS char(1)) AS asp_cancel
FROM dbo.v_stock_movement m
LEFT JOIN dbo.inv_cost_ledger c ON c.src = m.src AND c.rid = m.rid;
GO
CREATE OR ALTER VIEW dbo.v_stock_summary AS
WITH monthly AS (
  SELECT 仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位 AS 主单位,
         CASE WHEN 单据日期 IS NULL THEN N'未填日期' WHEN 单据日期 < '2020-01-01' THEN N'期初' WHEN 单据日期 > GETDATE() THEN N'日期异常' ELSE CONVERT(nvarchar(7), 单据日期, 120) END AS 期次,
         SUM(收入数量) AS 本期入库数量, SUM(收入金额) AS 本期入库金额,
         SUM(发出数量) AS 本期出库数量, SUM(发出金额) AS 本期出库金额
  FROM dbo.v_stock_ledger
  GROUP BY 仓库编码, 仓库, 存货编码, 存货, 规格型号, 计量单位,
           CASE WHEN 单据日期 IS NULL THEN N'未填日期' WHEN 单据日期 < '2020-01-01' THEN N'期初' WHEN 单据日期 > GETDATE() THEN N'日期异常' ELSE CONVERT(nvarchar(7), 单据日期, 120) END
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
       CASE WHEN 期次 LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]' THEN 期次 + '-01' END AS 开始日期,
       CASE WHEN 期次 LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
            THEN CONVERT(nvarchar(10), DATEADD(DAY, -1, DATEADD(MONTH, 1, 期次 + '-01')), 120) END AS 结束日期,
       仓库编码, 仓库, 存货编码, 存货, 规格型号, 主单位, 期次,
       期初数量, CASE WHEN 期初数量<>0 THEN 期初金额/期初数量 ELSE 0 END AS 期初平均单价, 期初金额,
       本期入库数量, CASE WHEN 本期入库数量<>0 THEN 本期入库金额/本期入库数量 ELSE 0 END AS 入库平均单价, 本期入库金额,
       本期出库数量, CASE WHEN 本期出库数量<>0 THEN 本期出库金额/本期出库数量 ELSE 0 END AS 出库平均单价, 本期出库金额,
       期末结存数量, CASE WHEN 期末结存数量<>0 THEN 期末结存金额/期末结存数量 ELSE 0 END AS 期末平均单价, 期末结存金额,
       CAST('N' AS char(1)) AS asp_cancel
FROM calc;
GO
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.v_stock_ledger', N'V') IS NULL SET @bad = @bad + 1;
IF OBJECT_ID(N'dbo.v_stock_summary', N'V') IS NULL SET @bad = @bad + 1;
DECLARE @l int = 0, @s int = 0, @qc int = 0, @yc int = 0;
IF @bad = 0 BEGIN
  SELECT @l = COUNT(*) FROM dbo.v_stock_ledger;
  SELECT @s = COUNT(*) FROM dbo.v_stock_summary;
  SELECT @qc = COUNT(*) FROM dbo.v_stock_summary WHERE 期次 = N'期初';
  SELECT @yc = COUNT(*) FROM dbo.v_stock_summary WHERE 期次 = N'日期异常';
END
DECLARE @dbn sysname = DB_NAME();
RAISERROR(N'[自检] %s:v_stock_ledger %d 行 / v_stock_summary %d 行;期初桶 %d;日期异常桶 %d;不符项 %d 条',
          10, 1, @dbn, @l, @s, @qc, @yc, @bad);
IF @bad = 0 RAISERROR(N'[OK] 两张库存视图已恢复(委外分支已摘,期次桶已收敛)', 10, 1);
ELSE RAISERROR(N'[FAIL] 视图恢复自检未过', 16, 1);
GO