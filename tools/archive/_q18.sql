-- 清理:删掉入库/出库面板所有 seq>=970 的补齐字段(列+面板+译名),供标签修正后重放
SET NOCOUNT ON;
DECLARE @pc varchar(40), @c nvarchar(200), @sql nvarchar(max);
DECLARE @ht nvarchar(50), @lt nvarchar(50);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT panel_code, col_name FROM yj_field
  WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND seq >= 970;
OPEN cur;
FETCH NEXT FROM cur INTO @pc, @c;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @ht = CASE @pc WHEN 'PURCHASE_IN' THEN 'bd_purchase_in' ELSE 'bd_sale_out' END;
  SET @lt = CASE @pc WHEN 'PURCHASE_IN' THEN 'bl_purchase_in' ELSE 'bl_sale_out' END;
  SET @sql = N'';
  SET @sql += N'IF COL_LENGTH(''dbo.' + @ht + ''', N''' + REPLACE(@c, '''', '''''') + N''') IS NOT NULL ALTER TABLE dbo.' + @ht + N' DROP COLUMN [' + REPLACE(@c, ']', ']]') + N'];';
  SET @sql += N'IF COL_LENGTH(''dbo.' + @lt + ''', N''' + REPLACE(@c, '''', '''''') + N''') IS NOT NULL ALTER TABLE dbo.' + @lt + N' DROP COLUMN [' + REPLACE(@c, ']', ']]') + N'];';
  EXEC(@sql);
  DELETE FROM yj_field WHERE panel_code = @pc AND col_name = @c;
  DELETE FROM yj_translation WHERE scope = 'field' AND ref_key = @c;
  FETCH NEXT FROM cur INTO @pc, @c;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'seq>=970 补齐字段清理完成';
GO
