SET NOCOUNT ON;
-- _q-drop-audit2.sql — 待下架面板的「全库面板引用面」审计:所有带 panel_code 列的表各有多少行;以及外键/索引
IF OBJECT_ID('tempdb..#p') IS NOT NULL DROP TABLE #p;
CREATE TABLE #p (code varchar(40) PRIMARY KEY);
INSERT INTO #p(code) VALUES
 ('PU_REQ'),('OTHER_IN'),('OTHER_IN_DETAIL'),('OTHER_IN_STATS'),('OTHER_OUT'),('OTHER_OUT_DETAIL'),
 ('OTHER_OUT_STATS'),('OUTSOURCE_IN'),('OUTSOURCE_IN_DETAIL'),('OUTSOURCE_IN_STATS'),
 ('OUTSOURCE_ISSUE'),('OUTSOURCE_ISSUE_DETAIL'),('OUTSOURCE_ISSUE_STATS'),
 ('FINISH_IN'),('FINISH_IN_DETAIL'),('FINISH_IN_STATS');
GO
-- ① 所有含 panel_code 列的表 × 待下架面板的行数
IF OBJECT_ID('tempdb..#hits') IS NOT NULL DROP TABLE #hits;
CREATE TABLE #hits (tbl sysname, col sysname, n int);
DECLARE @t sysname, @c sysname, @sql nvarchar(500), @n int;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT OBJECT_NAME(c.object_id), c.name FROM sys.columns c
  JOIN sys.tables t ON t.object_id = c.object_id
  WHERE c.name IN ('panel_code','PanelCode','panelCode')
  ORDER BY OBJECT_NAME(c.object_id);
OPEN cur; FETCH NEXT FROM cur INTO @t, @c;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'SELECT @x = COUNT(*) FROM ' + QUOTENAME(@t) + N' WHERE ' + QUOTENAME(@c) + N' IN (SELECT code FROM #p)';
  BEGIN TRY
    EXEC sp_executesql @sql, N'@x int OUTPUT', @n OUTPUT;
    IF @n > 0 INSERT INTO #hits VALUES (@t, @c, @n);
  END TRY
  BEGIN CATCH
    INSERT INTO #hits VALUES (@t, @c, -999);
  END CATCH
  FETCH NEXT FROM cur INTO @t, @c;
END
CLOSE cur; DEALLOCATE cur;
GO
SELECT tbl, col, n FROM #hits ORDER BY n DESC, tbl;
GO
-- ② 待删表的外键(父/子)
SELECT OBJECT_NAME(fk.parent_object_id) AS 子表, fk.name AS 外键,
       OBJECT_NAME(fk.referenced_object_id) AS 父表
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.parent_object_id) IN ('bd_pu_req','bl_pu_req','bd_other_in','bl_other_in','bd_other_out','bl_other_out','bd_outsource_in','bl_outsource_in','bd_outsource_issue','bl_outsource_issue','bd_finish_in','bl_finish_in')
   OR OBJECT_NAME(fk.referenced_object_id) IN ('bd_pu_req','bl_pu_req','bd_other_in','bl_other_in','bd_other_out','bl_other_out','bd_outsource_in','bl_outsource_in','bd_outsource_issue','bl_outsource_issue','bd_finish_in','bl_finish_in');
GO
-- ③ 待删表上的索引/约束数量(删表会一起带走,列出来备查)
SELECT OBJECT_NAME(i.object_id) AS 表, i.name AS 索引, i.type_desc AS 类型
FROM sys.indexes i
WHERE OBJECT_NAME(i.object_id) IN ('bd_pu_req','bl_pu_req','bd_other_in','bl_other_in','bd_other_out','bl_other_out','bd_outsource_in','bl_outsource_in','bd_outsource_issue','bl_outsource_issue','bd_finish_in','bl_finish_in')
  AND i.name IS NOT NULL
ORDER BY 表, 索引;
GO
-- ④ 库存流水/台账里有没有这些单据的痕迹
SELECT 'inh' AS t, ISNULL(单据类型,N'(空)') AS k, COUNT(*) AS n FROM dbo.inh GROUP BY 单据类型
UNION ALL SELECT 'outh', ISNULL(单据类型,N'(空)'), COUNT(*) FROM dbo.outh GROUP BY 单据类型
ORDER BY t, k;
