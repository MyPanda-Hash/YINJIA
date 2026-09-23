SET NOCOUNT ON;
-- INV 面板里所有含 库位/位置/货位 的字段
SELECT panel_code, col_name, label, place, editable, required, hidden, visible, ref_panel, ref_field, display_field, dict_sql
FROM yj_field
WHERE (col_name LIKE N'%库位%' OR label LIKE N'%库位%' OR col_name LIKE N'%货位%' OR label LIKE N'%货位%'
       OR col_name LIKE N'%位置%' OR label LIKE N'%位置%' OR col_name LIKE N'%仓位%' OR label LIKE N'%仓位%')
ORDER BY panel_code, seq;
GO
-- 物料/存货主表里含库位的物理列
SELECT t.name AS 表名, c.name AS 列名, ty.name AS 类型, c.max_length
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE (c.name LIKE N'%库位%' OR c.name LIKE N'%货位%' OR c.name LIKE N'%仓位%')
ORDER BY t.name, c.column_id;
GO
-- 物料/存货主表列清单候选
SELECT t.name AS 表名, COUNT(*) AS 列数
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name IN ('dm_inv','bs_inv','dm_material','inv','bd_inv','dm_wl')
GROUP BY t.name ORDER BY t.name;
GO
