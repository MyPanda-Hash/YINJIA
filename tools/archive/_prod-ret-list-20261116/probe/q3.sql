SELECT 'V|' + REPLACE(REPLACE(m.definition, CHAR(13), ' '), CHAR(10), ' ') FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id WHERE o.name='v_prod_pick_list';
