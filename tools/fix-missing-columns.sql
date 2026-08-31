-- 系统性修复:①bl_* 行表补 asp_cancel;②STATS 视图补 id 列
USE HSDZ_MES;
SET NOCOUNT ON;

-- ① 所有 bl_* 行表补 asp_cancel 列(仅缺列的表;原 OBJECT_ID(name) 里 name 误解析为内层 sys.columns.name,判断恒失效)
DECLARE @t sysname, @sql nvarchar(max);
DECLARE tc CURSOR FOR SELECT t.name FROM sys.tables t
  WHERE t.name LIKE 'bl[_]%' AND COL_LENGTH(t.name, 'asp_cancel') IS NULL;
OPEN tc; FETCH NEXT FROM tc INTO @t;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @sql = N'ALTER TABLE [' + @t + N'] ADD asp_cancel char(1) NULL DEFAULT ''N''';
  EXEC(@sql);
  SET @sql = N'UPDATE [' + @t + N'] SET asp_cancel = ''N'' WHERE asp_cancel IS NULL';
  EXEC(@sql);
  PRINT @t + ': asp_cancel 已补';
  FETCH NEXT FROM tc INTO @t;
END
CLOSE tc; DEALLOCATE tc;
GO

-- ② 重建缺 id 列的 STATS 视图(加 ROW_NUMBER AS id 供后端排序;已有 id 的跳过,避免重复注入)
DECLARE @vw sysname, @def nvarchar(max), @newDef nvarchar(max);
DECLARE vc CURSOR FOR SELECT v.name, m.definition FROM sys.views v JOIN sys.sql_modules m ON v.object_id=m.object_id
  WHERE v.name LIKE 'v[_]%stats'
  AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=v.object_id AND c.name='id');
OPEN vc; FETCH NEXT FROM vc INTO @vw, @def;
WHILE @@FETCH_STATUS = 0 BEGIN
  -- 在 SELECT 后加 ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id,
  SET @newDef = REPLACE(@def, 'CREATE VIEW', 'ALTER VIEW');
  SET @newDef = REPLACE(@newDef, ' AS SELECT ', ' AS SELECT ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS id, ');
  BEGIN TRY EXEC(@newDef); PRINT @vw + ': id 列已加'; END TRY
  BEGIN CATCH PRINT @vw + ': FAIL ' + ERROR_MESSAGE(); END CATCH
  FETCH NEXT FROM vc INTO @vw, @def;
END
CLOSE vc; DEALLOCATE vc;
GO

-- 验证
SELECT '缺asp_cancel行表' AS k, COUNT(*) AS v FROM sys.tables t WHERE t.name LIKE 'bl[_]%'
  AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name='asp_cancel')
UNION ALL
SELECT '缺id统计视图', COUNT(*) FROM sys.views v WHERE v.name LIKE 'v[_]%stats'
  AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=v.object_id AND c.name='id');
GO
