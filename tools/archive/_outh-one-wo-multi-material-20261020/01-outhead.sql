/* 只读取证:outh 唯一索引 (src,rid) 与「一个工单多个物料」的冲突面(2026-10-20) */
SET NOCOUNT ON;

PRINT N'== A. outh 上的唯一索引 ==';
SELECT i.name AS 索引, i.is_unique AS 唯一, i.has_filter AS 过滤, i.filter_definition AS 过滤条件,
       STUFF((SELECT ',' + c.name FROM sys.index_columns ic JOIN sys.columns c
                ON c.object_id = ic.object_id AND c.column_id = ic.column_id
               WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
               ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, '') AS 键列
  FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.outh') AND i.is_unique = 1;

PRINT N'== B. outh 全部列 ==';
SELECT c.column_id AS 序, c.name AS 列, t.name AS 类型, c.max_length AS 长, c.is_nullable AS 可空,
       CAST(ep.value AS nvarchar(300)) AS 注明
  FROM sys.columns c
  JOIN sys.types t ON t.user_type_id = c.user_type_id
  LEFT JOIN sys.extended_properties ep
         ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.class = 1 AND ep.name = 'MS_DESCRIPTION'
 WHERE c.object_id = OBJECT_ID('dbo.outh') ORDER BY c.column_id;

PRINT N'== C. outh 按 src/单据类型 汇总 ==';
SELECT src, 单据类型, COUNT(*) AS 行数, COUNT(DISTINCT rid) AS 不同rid,
       COUNT(DISTINCT 单据编号) AS 不同单号, MIN(CAST(rid AS nvarchar(20))) AS rid样例
  FROM dbo.outh GROUP BY src, 单据类型 ORDER BY src;

PRINT N'== D. outh 最近 40 行(看写入方痕迹)==';
SELECT TOP 40 id, src, rid, 单据编号, 单据类型, CONVERT(varchar(10),单据日期,120) AS 单据日期,
       物料编码, 仓库编码, 批号, 数量, 工单号, 工单项次, asp_user1 AS 写入人,
       CONVERT(varchar(19),asp_time1,120) AS 写入时间, asp_cancel AS 作废
  FROM dbo.outh ORDER BY id DESC;

PRINT N'== E. 同一 (src,rid) 是否已有 >1 行(索引允许的前提下)==';
SELECT src, rid, COUNT(*) AS 行数 FROM dbo.outh GROUP BY src, rid HAVING COUNT(*) > 1 ORDER BY 行数 DESC;
