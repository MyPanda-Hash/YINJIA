-- 清理 kucun 表的迁移写入者标记 asp_user2='kucun-resync'
-- 背景: kucun 是活结存缓存表(StockLedgerService 读写 + InvCostService 启动对账),
--       与 dbo.v_stock_balance 逐物料零差异(31 行 / SUM(yl)=15939.0 / 双向差集 0)。
--       asp_user2='kucun-resync' 只是 2026-10-08 那次全量回填的写入者标记,非业务数据。
-- 本脚本只清标记,不触碰任何结存数量/金额。
-- 执行范围: 双账套(先 HSDZ_MES 后 HSDZ_MES_TEST)
-- 执行日期: 2026-10-10

SET NOCOUNT ON;

PRINT N'--- before ---';
SELECT N'kucun 总行数' AS 项, COUNT(*) AS 值 FROM dbo.kucun
UNION ALL
SELECT N'带 kucun-resync 标记', COUNT(*) FROM dbo.kucun WHERE asp_user2 = N'kucun-resync'
UNION ALL
SELECT N'现存量合计(yl)', CAST(SUM(yl) AS DECIMAL(18,4)) FROM dbo.kucun;

BEGIN TRANSACTION;

UPDATE dbo.kucun
   SET asp_user2 = NULL
 WHERE asp_user2 = N'kucun-resync';

PRINT N'受影响行数: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));

COMMIT TRANSACTION;

PRINT N'--- after (回查验证) ---';
SELECT N'kucun 总行数' AS 项, COUNT(*) AS 值 FROM dbo.kucun
UNION ALL
SELECT N'带 kucun-resync 标记', COUNT(*) FROM dbo.kucun WHERE asp_user2 = N'kucun-resync'
UNION ALL
SELECT N'asp_user2 为 NULL', COUNT(*) FROM dbo.kucun WHERE asp_user2 IS NULL
UNION ALL
SELECT N'现存量合计(yl)', CAST(SUM(yl) AS DECIMAL(18,4)) FROM dbo.kucun;
