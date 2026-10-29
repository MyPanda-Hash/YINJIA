/* 探针:临时表用中文列名「档」在当前库是否可解析(排查 migrate-finish-in-wo-backfill-full-20261022.sql 报 Invalid column name '档')*/
SET NOCOUNT ON;
CREATE TABLE #t (单据编号 nvarchar(20), 档 nvarchar(2));
INSERT INTO #t (单据编号, 档) VALUES (N'A', N'M2');
SELECT 档, COUNT(*) AS 行数 FROM #t GROUP BY 档;
SELECT DATABASEPROPERTYEX(DB_NAME(), 'Collation') AS 库排序规则,
       SERVERPROPERTY('Collation') AS 实例排序规则;
DROP TABLE #t;
