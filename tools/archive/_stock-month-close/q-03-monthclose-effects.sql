-- q-03-monthclose-effects.sql — 月结「只动了该动的」取证:视图口径未变 + 流水只增了结转行 + 出库仅批号回写
SET NOCOUNT ON;
SELECT N'三张报表口径(现状)' AS k,
       (SELECT COUNT(*) FROM v_stock_balance) AS 状况表行数,
       (SELECT CAST(SUM(现存量) AS decimal(18,4)) FROM v_stock_balance) AS 状况表现存量,
       (SELECT CAST(SUM(收入数量 - 发出数量) AS decimal(18,4)) FROM v_stock_movement) AS 视图流水净额,
       (SELECT CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) FROM kucun) AS 结存表现存量;
GO
-- 含/不含「月结结转」行的净额差(差额应恰好等于结转行合计 ⇒ 证明视图确实排掉了它)
SELECT N'排除生效证明' AS k,
       (SELECT CAST(SUM(数量) AS decimal(18,4)) FROM inh WHERE 单据类型 = N'月结结转') AS 结转行合计,
       (SELECT CAST(SUM(收入数量 - 发出数量) AS decimal(18,4)) FROM v_stock_movement) AS 视图净额,
       (SELECT CAST(SUM(q) AS decimal(18,4)) FROM (
          SELECT 数量 AS q FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y'
          UNION ALL SELECT -数量 FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y') t) AS 含结转净额;
GO
SELECT N'今日写入 inh 按单据类型' AS k, ISNULL(单据类型,N'(空)') AS 单据类型, COUNT(*) AS 行数,
       MIN(CONVERT(nvarchar(19), asp_time1, 120)) AS 最早, MAX(CONVERT(nvarchar(19), asp_time1, 120)) AS 最晚
FROM inh WHERE asp_time1 >= CONVERT(date, GETDATE()) GROUP BY ISNULL(单据类型,N'(空)') ORDER BY 行数 DESC;
GO
SELECT N'今日 outh 变动(月结只回写批号)' AS k,
       SUM(CASE WHEN asp_user2 = N'monthclose' THEN 1 ELSE 0 END) AS 回写批号行,
       SUM(CASE WHEN asp_time1 >= CONVERT(date, GETDATE()) THEN 1 ELSE 0 END) AS 今日新增行,
       COUNT(*) AS 总行数
FROM outh;
GO
SELECT N'结转行分布(前 8 键)' AS k, 物料编码, 仓库编码, 批号, 数量, CONVERT(nvarchar(10), 单据日期, 120) AS 日期, 单据编号
FROM (SELECT TOP 8 物料编码, 仓库编码, 批号, 数量, 单据日期, 单据编号 FROM inh
      WHERE 单据类型 = N'月结结转' ORDER BY ABS(数量) DESC) x;
GO
