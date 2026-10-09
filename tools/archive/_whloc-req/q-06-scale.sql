SET NOCOUNT ON;
PRINT N'=== A. 全库物理列含 仓位/货位/库位/储位 (逐表逐列) ===';
SELECT t.name AS 表名, c.column_id AS 序, c.name AS 列名, ty.name AS 类型, c.max_length AS 字节,
       ISNULL(CAST(ep.value AS nvarchar(300)), N'') AS 中文注明
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id
     AND ep.class = 1 AND ep.name = 'MS_Description'
WHERE c.name LIKE N'%仓位%' OR c.name LIKE N'%货位%' OR c.name LIKE N'%库位%' OR c.name LIKE N'%储位%'
ORDER BY t.name, c.column_id;
GO
PRINT N'=== B. 按表汇总(改表工作量口径) ===';
SELECT t.name AS 表名, COUNT(*) AS 相关列数,
       SUM(CASE WHEN t.name LIKE 'bd[_]%' THEN 1 ELSE 0 END) AS 表头表
FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
WHERE c.name LIKE N'%仓位%' OR c.name LIKE N'%货位%' OR c.name LIKE N'%库位%' OR c.name LIKE N'%储位%'
GROUP BY t.name ORDER BY COUNT(*) DESC, t.name;
GO
PRINT N'=== C. 这些表挂在哪张面板(yj_panel.line_table / head_table) ===';
SELECT p.panel_code, p.panel_name, p.mode, p.line_table, p.head_table
FROM yj_panel p
WHERE p.line_table IN (SELECT DISTINCT t.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
        WHERE c.name LIKE N'%仓位%' OR c.name LIKE N'%库位%' OR c.name LIKE N'%货位%')
   OR p.head_table IN (SELECT DISTINCT t.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
        WHERE c.name LIKE N'%仓位%' OR c.name LIKE N'%库位%' OR c.name LIKE N'%货位%')
ORDER BY p.panel_code;
GO
PRINT N'=== D. 这些字段的 yj_field 元数据行数 ===';
SELECT COUNT(*) AS 仓位库位相关字段总数,
       SUM(CASE WHEN hidden=1 THEN 1 ELSE 0 END) AS 隐藏,
       SUM(CASE WHEN visible=0 THEN 1 ELSE 0 END) AS 不可见,
       SUM(CASE WHEN ref_panel IS NULL THEN 1 ELSE 0 END) AS 无参照源
FROM yj_field
WHERE col_name LIKE N'%仓位%' OR col_name LIKE N'%库位%' OR label LIKE N'%仓位%' OR label LIKE N'%库位%';
GO
PRINT N'=== E. 8 组出入库单据 头/行表 的仓位列归属(哪些表真的要挂库位) ===';
SELECT t.name AS 表名,
       CASE WHEN t.name LIKE 'bd[_]%' THEN N'单据头' WHEN t.name LIKE 'bl[_]%' THEN N'单据行' ELSE N'其它' END AS 层级,
       COUNT(*) AS 仓位相关列数, COUNT(DISTINCT c.name) AS 不同列名
FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
WHERE (t.name LIKE 'bd[_]%' OR t.name LIKE 'bl[_]%')
  AND (c.name LIKE N'%仓位%' OR c.name LIKE N'%库位%')
GROUP BY t.name ORDER BY t.name;
GO
PRINT N'=== F. 数据量(这些表有多少行,决定回填代价) ===';
SELECT N'bd_purchase_in' AS 表, COUNT(*) AS 行数 FROM dbo.bd_purchase_in
UNION ALL SELECT N'bl_purchase_in', COUNT(*) FROM dbo.bl_purchase_in
UNION ALL SELECT N'bl_sale_out', COUNT(*) FROM dbo.bl_sale_out
UNION ALL SELECT N'bl_material_out', COUNT(*) FROM dbo.bl_material_out
UNION ALL SELECT N'bl_pu_order', COUNT(*) FROM dbo.bl_pu_order
UNION ALL SELECT N'bl_so_order', COUNT(*) FROM dbo.bl_so_order
UNION ALL SELECT N'bs_inv', COUNT(*) FROM dbo.bs_inv
UNION ALL SELECT N'bs_wh', COUNT(*) FROM dbo.bs_wh
UNION ALL SELECT N'bs_wh_loc', COUNT(*) FROM dbo.bs_wh_loc;
GO
PRINT N'=== G. 库位档案现状(将被改造成层次结构的那张表) ===';
SELECT c.column_id AS 序, c.name AS 列名, ty.name AS 类型, c.max_length AS 字节
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.bs_wh_loc') ORDER BY c.column_id;
GO
PRINT N'=== H. 参照先例 DEPT 的完整行(库位要照抄的那一行) ===';
SELECT panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible,
       ref_panel, ref_field, display_field, ISNULL(ref_filter, N'(无)') AS ref_filter
FROM yj_field WHERE panel_code='DEPT' AND col_name IN (N'上级部门', N'上级编码', N'级次', N'长编码', N'部门全称', N'是否叶子节点');
GO
