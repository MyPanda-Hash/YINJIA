-- 期初导入前的档案对齐检查(只读)
SET NOCOUNT ON;

PRINT N'=== ① 仓库档案:金蝶18个仓 vs MES bs_wh ===';
SELECT 仓库编码, 仓库名称 FROM bs_wh ORDER BY 仓库编码;
GO

PRINT N'=== ② 档案行数 ===';
SELECT (SELECT COUNT(*) FROM bs_inv) AS bs_inv行数, (SELECT COUNT(*) FROM bs_wh) AS bs_wh行数,
       (SELECT COUNT(DISTINCT 仓库编码) FROM bs_wh) AS 仓库编码数;
GO

PRINT N'=== ③ kucun 三键是否重复 ===';
SELECT COUNT(*) AS 重复键数 FROM (
  SELECT wzdm, ckdm, ISNULL(RTRIM(lot_no),N'') AS lot FROM kucun
   WHERE ISNULL(asp_cancel,'N') <> 'Y'
   GROUP BY wzdm, ckdm, ISNULL(RTRIM(lot_no),N'')
  HAVING COUNT(*) > 1) t;
GO

PRINT N'=== ④ kucun 索引 ===';
SELECT i.name AS 索引名, i.is_unique AS 唯一, i.is_primary_key AS 主键,
       STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS 列
  FROM sys.indexes i
  JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
  JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
 WHERE i.object_id = OBJECT_ID('kucun')
 GROUP BY i.name, i.is_unique, i.is_primary_key;
GO

PRINT N'=== ⑤ MES 9/1 后流水按仓库分布 ===';
SELECT 业务, 仓库编码, COUNT(*) AS 行数 FROM (
  SELECT N'入' AS 业务, ISNULL(NULLIF(RTRIM(仓库编码),N''),N'(空)') AS 仓库编码 FROM inh
   WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= '2026-09-01'
  UNION ALL
  SELECT N'出', ISNULL(NULLIF(RTRIM(仓库编码),N''),N'(空)') FROM outh
   WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= '2026-09-01'
) t GROUP BY 业务, 仓库编码 ORDER BY 业务, 仓库编码;
GO

PRINT N'=== ⑥ 空批号 vs PC0000 批号占比(MES 侧)===';
SELECT ISNULL(NULLIF(RTRIM(批号),N''),N'(空)') AS 批号形态, COUNT(*) AS 行数 FROM inh
 WHERE ISNULL(asp_cancel,'N') <> 'Y' AND 单据日期 >= '2026-09-01'
 GROUP BY ISNULL(NULLIF(RTRIM(批号),N''),N'(空)') ORDER BY COUNT(*) DESC;
GO
