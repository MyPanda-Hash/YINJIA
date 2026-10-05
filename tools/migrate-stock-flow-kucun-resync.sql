/* =============================================================================
   migrate-stock-flow-kucun-resync.sql
   —— 按库存流水重建 kucun 结存缓存(库存三表"漏项收口"第二步)

   【前置】migrate-stock-flow-history-backfill.sql 已把「迁移前已审核」的历史单据补写成流水。
     补完之后流水才是**完整**的库存真源;而 kucun 只剩 7 条非零余量(遗留残缺余额,合计 7,011),
     与流水净额 38,087 差 31,076 ⇒ 后端启动自检「结存 == Σ流水」实测报 **227 个三键不一致**。

   【依据】本项目的三表设计口径是「**流水是唯一真源,kucun 只是结存缓存**」
     (见 InvCostService.reconcileStockOnStartup 的方法注释与 StockFlowService)。流水补齐后,
     kucun 就应当由流水派生 —— 否则那个自检会永远红着,健康信号失效。

   【键口径:严格照 key3()】InvCostService.key3 = String.valueOf(a)+'|'+b+'|'+c,即
     **原样字符串拼接,不去空格、也不把 NULL 与空串归一**:
       流水侧 = (inh/outh.物料编码, 仓库编码, 批号);kucun 侧 = (wzdm, ckdm, lot_no);
       NULL 渲染成字面量 "null",空串渲染成 "" —— 两者**不相等**。
     故本脚本一律用 **NULL 安全的显式比较** `(a = b OR (a IS NULL AND b IS NULL))` 做三键匹配
     (不用 INTERSECT:SQL Server 不接受相关子查询里的 INTERSECT),
     **不做** ISNULL/RTRIM 归一 —— 否则会把自检认为不同的两行当成同一行,
     出现"脚本说平了、启动仍报不一致"。⚠ 这是本脚本最容易写错的一点。

   【做什么】
     ① 流水里 仓库编码 为空、但 仓库名称 能在 bs_wh 命中的 → 回填 仓库编码
        (kucun.ckdm 是 NOT NULL,流水侧 NULL 永远配不上);
     ② kucun 已有三键 → yl 改成流水净额;
     ③ kucun 有、流水没有的三键 → yl 归 0(不删行:保留历史行与单价);
     ④ 流水有、kucun 没有的三键(净额非 0)→ 补插 kucun 行(comm 沿用既有行的 '0')。

   ⚠ 口径影响(需知情):kucun 是遗留「库存资料」表,同时供 **库存状况表(STOCK_STATUS)面板** 与
     首页库存卡片读取。重建后这些地方的现存量会由 7,011 变成 **38,087(单据口径)** ——
     与库存台账/收发存汇总一致。这是"以流水为准"的必然结果(迁移前报表本来就是单据口径,
     只是当时 kucun 与报表不一致、且还没有这个自检)。
     其中会有若干**负结存**行(只出无进:如销售出库的成品在 MES 里没有对应入库单据)——
     这是本库遗留数据的真实状态(InvCostService 注释早已记录「114 个分区只出无进」),不是本脚本造出来的。

   【幂等】全部按三键先判后改/先判后插;可重复跑,结果一致。两账套均执行。
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.inh', N'src') IS NULL
BEGIN
  PRINT N'[SKIP] inh 还是旧结构(无 src 列),先跑 migrate-stock-flow-tables-2026-09-30.sql';
  RETURN;
END
GO

PRINT N'==== ① 流水 NULL 仓库编码按 仓库名称 解析(bs_wh) ====';
GO
UPDATE i SET i.仓库编码 = w.仓库编码
  FROM inh i
  CROSS APPLY (SELECT TOP 1 仓库编码 FROM bs_wh x WHERE RTRIM(x.仓库名称) = RTRIM(i.仓库名称) ORDER BY x.id) w
 WHERE ISNULL(i.asp_cancel,'N') <> 'Y' AND i.仓库编码 IS NULL AND w.仓库编码 IS NOT NULL;
PRINT N'  inh 解析 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO
UPDATE o SET o.仓库编码 = w.仓库编码
  FROM outh o
  CROSS APPLY (SELECT TOP 1 仓库编码 FROM bs_wh x WHERE RTRIM(x.仓库名称) = RTRIM(o.仓库名称) ORDER BY x.id) w
 WHERE ISNULL(o.asp_cancel,'N') <> 'Y' AND o.仓库编码 IS NULL AND w.仓库编码 IS NOT NULL;
PRINT N'  outh 解析 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

PRINT N'==== ② 算流水净额(三键与 key3 同口径) ====';
GO
IF OBJECT_ID('tempdb..#net') IS NOT NULL DROP TABLE #net;
SELECT 物料编码, 仓库编码, 批号, CAST(SUM(净额) AS decimal(18,4)) AS 净额合计
  INTO #net
  FROM (
    SELECT 物料编码, 仓库编码, 批号, 数量 AS 净额 FROM inh  WHERE ISNULL(asp_cancel,'N') <> 'Y'
    UNION ALL
    SELECT 物料编码, 仓库编码, 批号, -数量      FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y'
  ) t
 GROUP BY 物料编码, 仓库编码, 批号;
-- ⚠ 不能写成 PRINT ... CAST((SELECT COUNT(*) FROM #net) AS ...) ——
--   SQL Server 报「在聚合函数中不能使用子查询」(实测踩到),必须先落变量。
DECLARE @netKeys int = (SELECT COUNT(*) FROM #net);
PRINT N'  流水三键 ' + CAST(@netKeys AS nvarchar(10)) + N' 个';
GO

PRINT N'==== ③ kucun 已有三键:yl 改成流水净额 ====';
GO
UPDATE k SET k.yl = CAST(n.净额合计 AS float), k.update_date = GETDATE(),
             k.asp_user2 = N'kucun-resync', k.asp_time2 = GETDATE()
  FROM kucun k
  JOIN #net n
    ON n.物料编码 = k.wzdm
   AND n.仓库编码 = k.ckdm
   AND (n.批号 = k.lot_no OR (n.批号 IS NULL AND k.lot_no IS NULL))
 WHERE ISNULL(k.asp_cancel,'N') <> 'Y';
PRINT N'  更新 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

PRINT N'==== ④ kucun 有、流水没有的三键 → yl 归 0 ====';
GO
UPDATE k SET k.yl = 0, k.update_date = GETDATE(),
             k.asp_user2 = N'kucun-resync', k.asp_time2 = GETDATE()
  FROM kucun k
 WHERE ISNULL(k.asp_cancel,'N') <> 'Y'
   AND NOT EXISTS (SELECT 1 FROM #net n
                    WHERE n.物料编码 = k.wzdm AND n.仓库编码 = k.ckdm
                      AND (n.批号 = k.lot_no OR (n.批号 IS NULL AND k.lot_no IS NULL)));
PRINT N'  归零 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

PRINT N'==== ⑤ 流水有、kucun 没有的三键 → 补插(净额非 0) ====';
GO
INSERT INTO kucun (comm, wzdm, ckdm, lot_no, yl, price, update_date,
                   asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)
SELECT N'0', n.物料编码, n.仓库编码, n.批号, CAST(n.净额合计 AS float), 0, GETDATE(),
       N'stock:kucun-resync', GETDATE(), N'kucun-resync', GETDATE(), N'N'
  FROM #net n
 WHERE ABS(n.净额合计) > 0.01
   AND n.仓库编码 IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM kucun k
                    WHERE ISNULL(k.asp_cancel,'N') <> 'Y'
                      AND k.wzdm = n.物料编码 AND k.ckdm = n.仓库编码
                      AND (k.lot_no = n.批号 OR (k.lot_no IS NULL AND n.批号 IS NULL)));
PRINT N'  补插 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

PRINT N'==== 自检:三键逐条比对(应 0 个不一致) ====';
GO
;WITH f AS (
  SELECT 物料编码, 仓库编码, 批号, SUM(净额) AS net FROM (
    SELECT 物料编码, 仓库编码, 批号, 数量 AS 净额 FROM inh  WHERE ISNULL(asp_cancel,'N') <> 'Y'
    UNION ALL
    SELECT 物料编码, 仓库编码, 批号, -数量     FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y'
  ) t GROUP BY 物料编码, 仓库编码, 批号
), s AS (
  SELECT wzdm AS 物料编码, ckdm AS 仓库编码, lot_no AS 批号, SUM(yl) AS net
    FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY wzdm, ckdm, lot_no
), j AS (
  SELECT ISNULL(f.net,0) AS fnet, ISNULL(s.net,0) AS snet
    FROM f FULL JOIN s
      ON s.物料编码 = f.物料编码 AND s.仓库编码 = f.仓库编码
     AND (s.批号 = f.批号 OR (s.批号 IS NULL AND f.批号 IS NULL))
)
SELECT N'不一致三键数(应=0)' AS 检查,
       (SELECT COUNT(*) FROM j WHERE ABS(fnet - snet) > 0.01) AS 不一致,
       (SELECT CAST(SUM(net) AS decimal(18,4)) FROM f) AS 流水净额合计,
       (SELECT CAST(SUM(yl) AS decimal(18,4)) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y') AS kucun余量合计,
       (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y') AS kucun行数;
GO
PRINT N'migrate-stock-flow-kucun-resync 完成(重启服务应见「[库存对账] 结存 == Σ流水,一致」)';
GO
