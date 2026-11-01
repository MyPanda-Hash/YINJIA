SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#d3') IS NOT NULL DROP TABLE #d3;
CREATE TABLE #d3(t sysname);
INSERT #d3 VALUES(N'plain');
SELECT COUNT(*) AS n_tables FROM sys.tables WHERE name='plang';
SELECT COUNT(*) AS n_d3 FROM #d3;
GO
DECLARE @i int=0;
WHILE @i < 3
BEGIN
  INSERT #d3 VALUES(CONCAT(N'loop',@i));
  SET @i=@i+1;
END
SELECT t FROM #d3 ORDER BY t;
GO
