-- 当前库存现状:负结存规模 / 期初行 / 流水与结存勾稽
SET NOCOUNT ON;

SELECT 'kucun行数' AS 指标, CAST(COUNT(*) AS varchar(30)) AS 值 FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y'
UNION ALL SELECT 'kucun负结存行数', CAST(COUNT(*) AS varchar(30)) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(yl,0) < 0
UNION ALL SELECT 'kucun余量合计', CAST(CAST(ISNULL(SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' THEN yl ELSE 0 END),0) AS decimal(18,2)) AS varchar(30)) FROM kucun
UNION ALL SELECT 'kucun负结存合计', CAST(CAST(ISNULL(SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'Y' AND yl<0 THEN yl ELSE 0 END),0) AS decimal(18,2)) AS varchar(30)) FROM kucun
UNION ALL SELECT 'inh期初行(src=0)', CAST(COUNT(*) AS varchar(30)) FROM inh WHERE src = 0
UNION ALL SELECT 'inh期初数量合计', CAST(CAST(ISNULL(SUM(数量),0) AS decimal(18,2)) AS varchar(30)) FROM inh WHERE src = 0
UNION ALL SELECT 'inh全部行', CAST(COUNT(*) AS varchar(30)) FROM inh
UNION ALL SELECT 'outh全部行', CAST(COUNT(*) AS varchar(30)) FROM outh
UNION ALL SELECT '流水净额', CAST(CAST(ISNULL((SELECT SUM(数量) FROM inh),0) - ISNULL((SELECT SUM(数量) FROM outh),0) AS decimal(18,2)) AS varchar(30));
GO

PRINT N'--- 期初行形态(src=0 的批次分布)---';
SELECT TOP 10 src, 单据编号, 单据类型, 单据日期, COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量合计
  FROM inh WHERE src = 0 GROUP BY src, 单据编号, 单据类型, 单据日期 ORDER BY 单据日期;
GO

PRINT N'--- 负结存样例(按金额/数量)---';
SELECT TOP 15 wzdm, ckdm, lot_no, CAST(yl AS decimal(18,2)) AS 余量, CAST(price AS decimal(18,4)) AS 单价, asp_user1, CONVERT(varchar(19), update_date, 120) AS 更新时间
  FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(yl,0) < 0 ORDER BY yl;
GO

PRINT N'--- 单据日期范围(判断9-1起点)---';
SELECT 'bd_purchase_in' AS 表, CONVERT(varchar(10), MIN(单据日期), 120) AS 最早, CONVERT(varchar(10), MAX(单据日期), 120) AS 最晚, COUNT(*) AS 单数 FROM bd_purchase_in
UNION ALL SELECT 'bd_sale_out', CONVERT(varchar(10), MIN(单据日期), 120), CONVERT(varchar(10), MAX(单据日期), 120), COUNT(*) FROM bd_sale_out
UNION ALL SELECT 'bd_material_out', CONVERT(varchar(10), MIN(单据日期), 120), CONVERT(varchar(10), MAX(单据日期), 120), COUNT(*) FROM bd_material_out
UNION ALL SELECT 'bd_finish_in', CONVERT(varchar(10), MIN(单据日期), 120), CONVERT(varchar(10), MAX(单据日期), 120), COUNT(*) FROM bd_finish_in
UNION ALL SELECT 'bd_other_in', CONVERT(varchar(10), MIN(单据日期), 120), CONVERT(varchar(10), MAX(单据日期), 120), COUNT(*) FROM bd_other_in
UNION ALL SELECT 'bd_other_out', CONVERT(varchar(10), MIN(单据日期), 120), CONVERT(varchar(10), MAX(单据日期), 120), COUNT(*) FROM bd_other_out;
GO
