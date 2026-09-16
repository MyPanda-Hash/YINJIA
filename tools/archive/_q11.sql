SET NOCOUNT ON;
-- 动态 SQL:逐列检查非空行数,只列出已显示且全空的
DECLARE @r TABLE(panel varchar(40), col nvarchar(200), cnt int);
DECLARE @sql nvarchar(max);
-- SO 行表已显示的字段
DECLARE c1 CURSOR FOR SELECT col_name FROM yj_field WHERE panel_code='SO_ORDER' AND place='detail' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1;
DECLARE @c nvarchar(200);
OPEN c1;
FETCH NEXT FROM c1 INTO @c;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @sql = N'SELECT ''SO_ORDER'', ''' + REPLACE(@c,'''','''''') + N''', COUNT(*) FROM bl_so_order WHERE [' + REPLACE(@c,']',']]') + N'] IS NOT NULL AND [' + REPLACE(@c,']',']]') + N'] IS NOT NULL -- ';
  INSERT INTO @r EXEC(@sql);
  FETCH NEXT FROM c1 INTO @c;
END
CLOSE c1; DEALLOCATE c1;
-- SO 头表已显示字段
DECLARE c2 CURSOR FOR SELECT col_name FROM yj_field WHERE panel_code='SO_ORDER' AND place LIKE '%header%' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1;
OPEN c2;
FETCH NEXT FROM c2 INTO @c;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @sql = N'SELECT ''SO_ORDER'', ''' + REPLACE(@c,'''','''''') + N''', COUNT(*) FROM bd_so_order WHERE [' + REPLACE(@c,']',']]') + N'] IS NOT NULL AND [' + REPLACE(@c,']',']]') + N'] IS NOT NULL -- ';
  INSERT INTO @r EXEC(@sql);
  FETCH NEXT FROM c2 INTO @c;
END
CLOSE c2; DEALLOCATE c2;
-- PU 行表
DECLARE c3 CURSOR FOR SELECT col_name FROM yj_field WHERE panel_code='PU_ORDER' AND place='detail' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1;
OPEN c3;
FETCH NEXT FROM c3 INTO @c;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @sql = N'SELECT ''PU_ORDER'', ''' + REPLACE(@c,'''','''''') + N''', COUNT(*) FROM bl_pu_order WHERE [' + REPLACE(@c,']',']]') + N'] IS NOT NULL AND [' + REPLACE(@c,']',']]') + N'] IS NOT NULL -- ';
  INSERT INTO @r EXEC(@sql);
  FETCH NEXT FROM c3 INTO @c;
END
CLOSE c3; DEALLOCATE c3;
-- PU 头表
DECLARE c4 CURSOR FOR SELECT col_name FROM yj_field WHERE panel_code='PU_ORDER' AND place LIKE '%header%' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1;
OPEN c4;
FETCH NEXT FROM c4 INTO @c;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @sql = N'SELECT ''PU_ORDER'', ''' + REPLACE(@c,'''','''''') + N''', COUNT(*) FROM bd_pu_order WHERE [' + REPLACE(@c,']',']]') + N'] IS NOT NULL AND [' + REPLACE(@c,']',']]') + N'] IS NOT NULL -- ';
  INSERT INTO @r EXEC(@sql);
  FETCH NEXT FROM c4 INTO @c;
END
CLOSE c4; DEALLOCATE c4;
-- KHDA
DECLARE c5 CURSOR FOR SELECT col_name FROM yj_field WHERE panel_code='KHDA' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1;
OPEN c5;
FETCH NEXT FROM c5 INTO @c;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @sql = N'SELECT ''KHDA'', ''' + REPLACE(@c,'''','''''') + N''', COUNT(*) FROM dm_kh WHERE 外部数据ID IS NOT NULL AND [' + REPLACE(@c,']',']]') + N'] IS NOT NULL AND [' + REPLACE(@c,']',']]') + N'] IS NOT NULL -- ';
  INSERT INTO @r EXEC(@sql);
  FETCH NEXT FROM c5 INTO @c;
END
CLOSE c5; DEALLOCATE c5;
-- GFDA
DECLARE c6 CURSOR FOR SELECT col_name FROM yj_field WHERE panel_code='GFDA' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1;
OPEN c6;
FETCH NEXT FROM c6 INTO @c;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @sql = N'SELECT ''GFDA'', ''' + REPLACE(@c,'''','''''') + N''', COUNT(*) FROM dm_gf WHERE 外部数据ID IS NOT NULL AND [' + REPLACE(@c,']',']]') + N'] IS NOT NULL AND [' + REPLACE(@c,']',']]') + N'] IS NOT NULL -- ';
  INSERT INTO @r EXEC(@sql);
  FETCH NEXT FROM c6 INTO @c;
END
CLOSE c6; DEALLOCATE c6;
-- INV
DECLARE c7 CURSOR FOR SELECT col_name FROM yj_field WHERE panel_code='INV' AND ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1;
OPEN c7;
FETCH NEXT FROM c7 INTO @c;
WHILE @@FETCH_STATUS = 0 BEGIN
  SET @sql = N'SELECT ''INV'', ''' + REPLACE(@c,'''','''''') + N''', COUNT(*) FROM bs_inv WHERE 外部数据ID IS NOT NULL AND [' + REPLACE(@c,']',']]') + N'] IS NOT NULL AND [' + REPLACE(@c,']',']]') + N'] IS NOT NULL -- ';
  INSERT INTO @r EXEC(@sql);
  FETCH NEXT FROM c7 INTO @c;
END
CLOSE c7; DEALLOCATE c7;
-- 输出:全空的已显示字段
SELECT r.panel, r.col, f.label, r.cnt AS 非空行数 FROM @r r
LEFT JOIN yj_field f ON f.panel_code = r.panel AND f.col_name = r.col
WHERE r.cnt = 0 ORDER BY r.panel, f.seq;
PRINT N'完成';
