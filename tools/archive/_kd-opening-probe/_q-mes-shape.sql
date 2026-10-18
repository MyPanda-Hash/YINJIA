-- MES 侧承接期初的结构底数(只读)
SET NOCOUNT ON;

PRINT N'=== ① inh 期初行现状(按 单据编号 分组) ===';
SELECT 单据编号, 单据类型, CONVERT(varchar(10), 单据日期, 120) AS 单据日期, COUNT(*) AS 行数,
       CAST(SUM(数量) AS decimal(18,2)) AS 数量合计
  FROM inh WHERE src = 0 GROUP BY 单据编号, 单据类型, 单据日期 ORDER BY 单据编号;
GO

PRINT N'=== ② inh 列结构 ===';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS 长度, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'inh' ORDER BY ORDINAL_POSITION;
GO

PRINT N'=== ③ kucun 列结构 ===';
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
  FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'kucun' ORDER BY ORDINAL_POSITION;
GO

PRINT N'=== ④ kucun 的行来源分布(asp_user1) ===';
SELECT ISNULL(asp_user1, N'(空)') AS 来源, COUNT(*) AS 行数, CAST(SUM(yl) AS decimal(18,2)) AS 余量合计
  FROM kucun GROUP BY asp_user1 ORDER BY COUNT(*) DESC;
GO

PRINT N'=== ⑤ 9/1 后 MES 流水的单据类型分布 ===';
SELECT 单据类型, COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量合计, CONVERT(varchar(10), MIN(单据日期), 120) AS 最早, CONVERT(varchar(10), MAX(单据日期), 120) AS 最晚
  FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' GROUP BY 单据类型;
GO

PRINT N'=== ⑥ v_stock_movement 视图定义(前 40 行) ===';
SELECT TOP 40 OBJECT_DEFINITION(OBJECT_ID('v_stock_movement')) AS 定义;
GO

PRINT N'=== ⑦ 月结结转行 ===';
SELECT COUNT(*) AS 结转行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量合计
  FROM inh WHERE 单据类型 = N'月结结转' AND ISNULL(asp_cancel,'N') <> 'Y';
GO
