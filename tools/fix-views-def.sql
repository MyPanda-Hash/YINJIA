-- 修复 definitive:DETAIL 视图用 h.* JOIN l.*(排除重复列),逐个 EXEC 生成
USE HSDZ_MES;
SET NOCOUNT ON;
DECLARE @d nvarchar(max), @n sysname;
DECLARE c CURSOR FOR SELECT name FROM sys.views WHERE name LIKE 'v[_]%';
OPEN c; FETCH NEXT FROM c INTO @n;
WHILE @@FETCH_STATUS = 0 BEGIN SET @d = N'DROP VIEW [' + @n + N']'; EXEC(@d); FETCH NEXT FROM c INTO @n; END
CLOSE c; DEALLOCATE c;
-- DETAIL:包装层法(子查询 = 原 JOIN,外层加 asp_cancel=NULL)
-- 列名自动发现,排除 id/asp 列避免重复
DECLARE @pairs TABLE (code varchar(50), head sysname, line sysname, noCol sysname);
INSERT INTO @pairs VALUES
('purchase_in','bd_purchase_in','bl_purchase_in','单据编号'),
('finish_in','bd_finish_in','bl_finish_in','单据编号'),
('other_in','bd_other_in','bl_other_in','单据编号'),
('sale_out','bd_sale_out','bl_sale_out','单据编号'),
('material_out','bd_material_out','bl_material_out','单据编号'),
('other_out','bd_other_out','bl_other_out','单据编号'),
('manu_order','bd_manu_order','bl_manu_order','合同号'),
('dispatch','bd_dispatch','bl_dispatch','单据编号'),
('outsource_issue','bd_outsource_issue','bl_outsource_issue','单据编号'),
('outsource_in','bd_outsource_in','bl_outsource_in','单据编号');
DECLARE @code varchar(50), @h sysname, @l sysname, @nc sysname, @lineCols nvarchar(max), @sql nvarchar(max);
DECLARE p CURSOR FOR SELECT code, head, line, noCol FROM @pairs;
OPEN p; FETCH NEXT FROM p INTO @code, @h, @l, @nc;
WHILE @@FETCH_STATUS = 0 BEGIN
  -- 自动发现行表列(排除 id/asp 列/单据编号列/与头表同名列)
  SET @lineCols = '';
  SELECT @lineCols = @lineCols + ', l.[' + c.name + ']' FROM sys.columns c
  WHERE c.object_id = OBJECT_ID(@l)
    AND c.name NOT IN ('id','asp_user1','asp_time1','asp_cancel','asp_user2','asp_time2', @nc)
    AND c.name NOT IN (SELECT c2.name FROM sys.columns c2 WHERE c2.object_id = OBJECT_ID(@h))
  ORDER BY c.column_id;
  -- DETAIL
  SET @sql = N'CREATE VIEW v_' + @code + '_detail AS SELECT t.*, CAST(NULL AS char(1)) AS asp_cancel FROM (SELECT h.*' + @lineCols + N' FROM ' + @h + N' h LEFT JOIN ' + @l + N' l ON h.[' + @nc + N']=l.[' + @nc + N']) t';
  EXEC(@sql);
  PRINT @code + ': detail OK';
  FETCH NEXT FROM p INTO @code, @h, @l, @nc;
END
CLOSE p; DEALLOCATE p;
