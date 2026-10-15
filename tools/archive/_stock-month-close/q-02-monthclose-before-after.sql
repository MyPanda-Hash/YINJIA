-- q-02-monthclose-before-after.sql — 月结前后对照取证(写库动作的留痕;两账套各跑一次)
SET NOCOUNT ON;
SELECT N'月结状态' AS k, 期间, 状态, 结转单据编号, CONVERT(nvarchar(19), 月结时间, 120) AS 月结时间, 行数, 入库合计, 出库合计, 结存合计
FROM bd_stock_close ORDER BY 期间 DESC;
GO
SELECT N'结转行' AS k, 单据编号, 单据类型, COUNT(*) AS 行数, SUM(数量) AS 合计,
       MIN(CONVERT(nvarchar(10), 单据日期, 120)) AS 日期, MAX(asp_user1) AS 写入来源
FROM inh WHERE 单据类型 = N'月结结转' GROUP BY 单据编号, 单据类型;
GO
SELECT N'kucun 现状' AS k, COUNT(*) AS 行数, SUM(ISNULL(yl,0)) AS 现存量合计,
       SUM(CASE WHEN ISNULL(yl,0) < 0 THEN 1 ELSE 0 END) AS 负值行,
       SUM(CASE WHEN asp_user2 LIKE 'monthclose%' THEN 1 ELSE 0 END) AS 被月结重算行
FROM kucun;
GO
SELECT N'ba_stock_close 行数' AS k, COUNT(*) AS 行数, SUM(结存数量) AS 结存合计,
       SUM(CASE WHEN 结存数量 < 0 THEN 1 ELSE 0 END) AS 负结存行
FROM bl_stock_close;
GO
SELECT N'视图口径未变(应为 0)' AS k, COUNT(*) AS 结转行混进视图的条数 FROM v_stock_movement WHERE 单据类型 = N'月结结转';
GO
