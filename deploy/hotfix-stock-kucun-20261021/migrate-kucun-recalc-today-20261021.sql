/* =============================================================================
   migrate-kucun-recalc-today-20261021.sql
   —— 把「结存缓存」kucun 按**全部流水**重算到今天,并清掉"任何日期都没有流水"的残影行

   【为什么】(2026-10-21 用户报障:采购入库单 CGRK-20261011-03389 已审核、流水也在,
   但《库存明细》里查不到;该面板还整表显示"共 0 条")
     ① 2026-09 月结(10-19 15:02)把 kucun 重算成「截至 2026-10-01」⇒ 10 月已发生的
        1,359 行流水被踢出结存,《库存明细》停在 9 月末;
     ② 同一方法的"孤儿行清零"判据带 `单据日期 < 期末`,把"流水全在期末之后"的真实库存
        也当成换键残影写成 rkl=0/ckl=0/yl=0(实测 434 键,其中 289 键其实有货 349,496.10);
        而视图 v_stock_kucun 有 `HAVING SUM(yl)<>0` ⇒ 零行被隐藏 ⇒ 单据在、货看不到。
   取证:docs/development/库存状况异常-当前取证与提交影响-20261021.md §2.2 / §七。

   【本脚本做四件事】(与代码修复同口径;代码改的是 StockMonthCloseService 2026-10-21 那两处)
     ① 算流水净额:入库 + / 出库 −,**排除月结结转行**,截止"明天"(不把未来日期的单据算进结存);
     ② kucun 已有键 ⇒ 覆盖成流水真值(rkl/ckl/yl);
     ③ 流水有、kucun 没有 ⇒ 补插(净额非 0);
     ④ 残影清零:**任何日期都没有流水**的 `asp_user1 LIKE 'stock:%'` 行才清(不再按期末截断)。

   【幂等】同输入同输出,可重复执行;不删任何行(清零是 UPDATE 留痕:asp_user2='orphan-purge-20261021')。
   【执行】两账套都要跑(先正式、后测试):
     cd tools
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-kucun-recalc-today-20261021.sql
     测试账套:先 set YINJIA_SQL_DB=HSDZ_MES_TEST 再执行同一条
   【前置】执行前请先备份数据库(BACKUP DATABASE … WITH FORMAT, INIT)。
   ============================================================================= */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;   -- inh/outh 上有过滤索引,DML 必须在此开关下(否则报 1934)
GO

IF OBJECT_ID('dbo.kucun') IS NULL OR OBJECT_ID('dbo.inh') IS NULL OR OBJECT_ID('dbo.outh') IS NULL
BEGIN
  PRINT N'[SKIP] 缺 kucun/inh/outh,先跑库存三表迁移';
  RETURN;
END
GO

PRINT N'==== ⓪ 改前对照 ====';
SELECT 库 = DB_NAME(), kucun行数 = COUNT(*), Σ现存量 = CAST(ISNULL(SUM(yl),0) AS decimal(18,4)),
       零行数 = SUM(CASE WHEN yl = 0 THEN 1 ELSE 0 END), 负行数 = SUM(CASE WHEN yl < 0 THEN 1 ELSE 0 END)
FROM kucun;
GO

PRINT N'==== ① 算流水净额(截止明天,排除月结结转) ====';
IF OBJECT_ID('tempdb..#net') IS NOT NULL DROP TABLE #net;
SELECT 物料编码 = ISNULL(RTRIM(物料编码), N''),
       仓库编码 = ISNULL(RTRIM(仓库编码), N''),
       批号 = ISNULL(RTRIM(批号), N''),
       yl = CAST(SUM(q) AS decimal(18,4)),
       cum_in = CAST(SUM(CASE WHEN q > 0 THEN q ELSE 0 END) AS decimal(18,4)),
       cum_out = CAST(SUM(CASE WHEN q < 0 THEN -q ELSE 0 END) AS decimal(18,4))
  INTO #net
  FROM (
    SELECT 物料编码, 仓库编码, 批号, 数量 AS q FROM inh
     WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'月结结转'
       AND 单据日期 < DATEADD(day, 1, CAST(GETDATE() AS date))
    UNION ALL
    SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh
     WHERE ISNULL(asp_cancel,'N') <> 'Y'
       AND 单据日期 < DATEADD(day, 1, CAST(GETDATE() AS date))
  ) t
 GROUP BY ISNULL(RTRIM(物料编码), N''), ISNULL(RTRIM(仓库编码), N''), ISNULL(RTRIM(批号), N'');
-- ⚠ 不能写成 PRINT … CAST((SELECT COUNT(*) FROM #net) AS …) —— SQL Server 报
--   「Subqueries are not allowed in this context」(实测踩到),必须先落变量。
DECLARE @netKeys int = (SELECT COUNT(*) FROM #net);
PRINT N'  流水三键 = ' + CAST(@netKeys AS nvarchar(20));
GO

PRINT N'==== ② kucun 已有键:覆盖成流水真值 ====';
UPDATE k
   SET rkl = n.cum_in, ckl = n.cum_out, yl = n.yl,
       update_date = GETDATE(), asp_user2 = N'recalc-20261021', asp_time2 = GETDATE()
  FROM kucun k
  JOIN #net n
    ON n.物料编码 = k.wzdm
   AND n.仓库编码 = ISNULL(RTRIM(k.ckdm), N'')
   AND n.批号 = ISNULL(RTRIM(k.lot_no), N'');
PRINT N'  更新 ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' 行';
GO

PRINT N'==== ③ 流水有、kucun 没有:补插(净额非 0) ====';
INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, asp_user1, asp_time1, asp_cancel)
SELECT n.物料编码, n.仓库编码, NULLIF(n.批号, N''), GETDATE(), n.cum_in, n.cum_out, n.yl,
       N'recalc:20261021', GETDATE(), 'N'
  FROM #net n
 WHERE n.物料编码 <> N'' AND n.仓库编码 <> N'' AND n.yl <> 0
   AND NOT EXISTS (SELECT 1 FROM kucun k
                    WHERE k.wzdm = n.物料编码
                      AND ISNULL(RTRIM(k.ckdm), N'') = n.仓库编码
                      AND ISNULL(RTRIM(k.lot_no), N'') = n.批号);
PRINT N'  新增 ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' 行';
GO

PRINT N'==== ④ 残影清零:任何日期都没有流水的 stock:% 行 ====';
-- ⚠ kucun.asp_user1/asp_user2 是 nvarchar(20):标记必须 ≤20 字符,否则
--   「String or binary data would be truncated」(实测:'orphan-purge-20261021' 21 字符踩到)。
UPDATE kucun
   SET rkl = 0, ckl = 0, yl = 0,
       update_date = GETDATE(), asp_user2 = N'orphan-purge:1021', asp_time2 = GETDATE()
 WHERE ISNULL(asp_user1, N'') LIKE 'stock:%'
   AND NOT EXISTS (SELECT 1 FROM inh x
                    WHERE ISNULL(RTRIM(x.物料编码), N'') = kucun.wzdm
                      AND ISNULL(RTRIM(x.仓库编码), N'') = ISNULL(RTRIM(kucun.ckdm), N'')
                      AND ISNULL(RTRIM(x.批号), N'') = ISNULL(RTRIM(kucun.lot_no), N'')
                      AND ISNULL(x.asp_cancel,'N') <> 'Y'
                      AND ISNULL(x.单据类型,'') <> N'月结结转')
   AND NOT EXISTS (SELECT 1 FROM outh y
                    WHERE ISNULL(RTRIM(y.物料编码), N'') = kucun.wzdm
                      AND ISNULL(RTRIM(y.仓库编码), N'') = ISNULL(RTRIM(kucun.ckdm), N'')
                      AND ISNULL(RTRIM(y.批号), N'') = ISNULL(RTRIM(kucun.lot_no), N'')
                      AND ISNULL(y.asp_cancel,'N') <> 'Y');
PRINT N'  残影清零 ' + CAST(@@ROWCOUNT AS nvarchar(20)) + N' 行';
GO

PRINT N'==== ⑤ 自检(全 0 才 OK) ====';
;WITH f AS (
  SELECT 物料编码 = ISNULL(RTRIM(物料编码), N''), 仓库编码 = ISNULL(RTRIM(仓库编码), N''),
         批号 = ISNULL(RTRIM(批号), N''), 净额 = SUM(q)
    FROM (
      SELECT 物料编码, 仓库编码, 批号, 数量 AS q FROM inh
       WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'月结结转'
         AND 单据日期 < DATEADD(day, 1, CAST(GETDATE() AS date))
      UNION ALL
      SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh
       WHERE ISNULL(asp_cancel,'N') <> 'Y'
         AND 单据日期 < DATEADD(day, 1, CAST(GETDATE() AS date))
    ) t
   GROUP BY ISNULL(RTRIM(物料编码), N''), ISNULL(RTRIM(仓库编码), N''), ISNULL(RTRIM(批号), N'')
)
SELECT 检查 = '① 结存 Σyl − 流水 Σ净额',
       值 = CAST((SELECT ISNULL(SUM(yl),0) FROM kucun) - (SELECT ISNULL(SUM(净额),0) FROM f) AS decimal(18,4))
UNION ALL
SELECT '② 有流水却仍是 0 的键数(应为 0)',
       CAST((SELECT COUNT(*) FROM kucun k JOIN f
              ON f.物料编码 = k.wzdm AND f.仓库编码 = ISNULL(RTRIM(k.ckdm), N'')
             AND f.批号 = ISNULL(RTRIM(k.lot_no), N'')
             WHERE k.yl = 0 AND ABS(f.净额) > 0.0001) AS decimal(18,4))
UNION ALL
SELECT '③ yl ≠ rkl − ckl 的行数(应为 0)',
       CAST((SELECT COUNT(*) FROM kucun WHERE ABS(yl - (rkl - ckl)) > 0.0001) AS decimal(18,4))
UNION ALL
SELECT '④ kucun 行数', CAST((SELECT COUNT(*) FROM kucun) AS decimal(18,4))
UNION ALL
SELECT '⑤ 零行数', CAST((SELECT COUNT(*) FROM kucun WHERE yl = 0) AS decimal(18,4));
GO

PRINT N'migrate-kucun-recalc-today-20261021 完成:①②③ 全 0 即正常';
GO
