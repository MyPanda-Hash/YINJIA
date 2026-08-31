-- 修复:报表视图补 asp_cancel 列(后端通用查询的软删过滤条件)
USE HSDZ_MES;
SET NOCOUNT ON;
DECLARE @name sysname, @def nvarchar(max), @newdef nvarchar(max), @fromPos int;
DECLARE c CURSOR FOR SELECT v.name FROM sys.views v WHERE v.name LIKE 'v[_]%' ORDER BY v.name;
OPEN c;
FETCH NEXT FROM c INTO @name;
WHILE @@FETCH_STATUS = 0 BEGIN
  SELECT @def = m.definition FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID(@name);
  IF @def NOT LIKE '%asp_cancel%' BEGIN
    SET @fromPos = PATINDEX('% FROM %', @def);
    IF @fromPos > 0 BEGIN
      SET @newdef = STUFF(@def, @fromPos, 0, CASE WHEN @def LIKE '%bd[_]%' THEN ', h.asp_cancel' ELSE ', NULL AS asp_cancel' END + ' ');
      SET @newdef = REPLACE(@newdef, 'CREATE VIEW', 'ALTER VIEW');
      BEGIN TRY EXEC(@newdef); PRINT @name + ': OK'; END TRY
      BEGIN CATCH PRINT @name + ': FAIL ' + ERROR_MESSAGE(); END CATCH
    END
  END ELSE PRINT @name + ': 已有';
  FETCH NEXT FROM c INTO @name;
END
CLOSE c; DEALLOCATE c;
-- 验证
SELECT v.name, CASE WHEN EXISTS (SELECT 1 FROM sys.columns c2 WHERE c2.object_id = v.object_id AND c2.name = 'asp_cancel') THEN 'Y' ELSE 'N' END AS has_cancel
FROM sys.views v WHERE v.name LIKE 'v[_]%';
