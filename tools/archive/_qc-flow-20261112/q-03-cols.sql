-- q-03-cols.sql — 每张表的列清单(compat-safe:FOR XML PATH 聚合)
SET NOCOUNT ON;
SELECT d.compatibility_level AS 兼容级别, SERVERPROPERTY('ProductVersion') AS 版本
  FROM sys.databases d WHERE d.database_id = DB_ID();
IF OBJECT_ID('tempdb..#t') IS NOT NULL DROP TABLE #t;
CREATE TABLE #t (tbl sysname PRIMARY KEY);
INSERT INTO #t (tbl) VALUES (N'sl_recv'), (N'sl_recv_detail'), (N'qc_insp'), (N'qc_insp_detail'),
                            (N'bd_purchase_in'), (N'bl_purchase_in'), (N'qc_catalog'), (N'qc_catalog_detail'),
                            (N'qc_insp_rec');
SELECT t.tbl AS 表名,
       (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.' + t.tbl)) AS 列数,
       STUFF((SELECT N',' + c.name
                FROM sys.columns c
               WHERE c.object_id = OBJECT_ID(N'dbo.' + t.tbl)
               ORDER BY c.column_id
               FOR XML PATH(''), TYPE).value(N'.', N'nvarchar(max)'), 1, 1, N'') AS 列清单
  FROM #t t ORDER BY t.tbl;
