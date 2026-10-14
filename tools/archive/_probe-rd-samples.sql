SET NOCOUNT ON;
-- 研发模块头表样本:看单据编号规律与创建时间,判断「真实业务 / 演示 / 探针垃圾」
DECLARE @code nvarchar(64), @head sysname, @sql nvarchar(600), @hasNo bit, @hasT bit, @hasU bit;
DECLARE cur CURSOR FOR
  SELECT panel_code, head_table FROM yj_panel
   WHERE panel_code LIKE N'RD[_]%' AND head_table IS NOT NULL AND OBJECT_ID(head_table) IS NOT NULL
   ORDER BY panel_code;
OPEN cur; FETCH NEXT FROM cur INTO @code, @head;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @hasNo = CASE WHEN COL_LENGTH(@head, N'单据编号') IS NOT NULL THEN 1 ELSE 0 END;
  SET @hasT  = CASE WHEN COL_LENGTH(@head, N'asp_time1') IS NOT NULL THEN 1 ELSE 0 END;
  SET @hasU  = CASE WHEN COL_LENGTH(@head, N'asp_user1') IS NOT NULL THEN 1 ELSE 0 END;
  IF @hasNo = 1
  BEGIN
    SET @sql = N'SELECT TOP 4 ''' + @code + N''' AS panel, 单据编号'
      + CASE WHEN @hasT = 1 THEN N', CONVERT(varchar(19), asp_time1, 120) AS 创建时间' ELSE N'' END
      + CASE WHEN @hasU = 1 THEN N', asp_user1 AS 创建人' ELSE N'' END
      + N', ISNULL(asp_cancel,''N'') AS 取消 FROM ' + QUOTENAME(@head) + N' ORDER BY 单据编号';
    EXEC sp_executesql @sql;
  END
  FETCH NEXT FROM cur INTO @code, @head;
END
CLOSE cur; DEALLOCATE cur;
