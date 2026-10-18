-- 期初导入后活体验证(直接用报表视图,与界面同源口径;只读)
SET NOCOUNT ON;

PRINT N'=== ① kucun 结存(库存明细/状况表读的就是它)===';
SELECT COUNT(*) AS 行数, CAST(ISNULL(SUM(yl),0) AS decimal(18,2)) AS 余量合计,
       SUM(CASE WHEN yl < 0 THEN 1 ELSE 0 END) AS 负结存行
  FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO

PRINT N'=== ② inh 期初行 ===';
SELECT 单据编号, 单据类型, CONVERT(varchar(10), 单据日期, 120) AS 单据日期, COUNT(*) AS 行数,
       CAST(SUM(数量) AS decimal(18,2)) AS 数量合计
  FROM inh WHERE src = 0 GROUP BY 单据编号, 单据类型, 单据日期;
GO

PRINT N'=== ③ 三张报表视图的合计(与界面同源)===';
SELECT 'v_stock_movement' AS 视图, COUNT(*) AS 行数 FROM v_stock_movement;
GO
SELECT 'v_stock_balance' AS 视图, COUNT(*) AS 行数,
       CAST(ISNULL(SUM(CAST(现存量 AS decimal(18,2))),0) AS decimal(18,2)) AS 现存量合计
  FROM v_stock_balance;
GO

PRINT N'=== ④ 负结存明细(确认没有漏网)===';
SELECT TOP 5 wzdm, ckdm, lot_no, yl FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND yl < 0;
GO

PRINT N'=== ⑤ 抽样:某物料的库存,与金蝶期初比对 ===';
SELECT k.wzdm, k.ckdm, ISNULL(k.lot_no,N'(无批号)') AS 批号, CAST(k.yl AS decimal(18,2)) AS MES结存,
       (SELECT TOP 1 ISNULL(i.存货名称,N'') FROM bs_inv i WHERE RTRIM(i.存货编码)=RTRIM(k.wzdm)) AS 物料名称
  FROM kucun k WHERE ISNULL(k.asp_cancel,'N') <> 'Y'
   AND k.wzdm IN (N'A-32-01', N'HS-2040', N'YJ-SX-043', N'YJ-CH-023')
 ORDER BY k.wzdm DESC, k.ckdm;
GO
