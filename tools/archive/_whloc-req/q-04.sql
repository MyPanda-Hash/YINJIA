SET NOCOUNT ON;
PRINT N'=== 1. 仓位/库位 字段定义(yj_field) ===';
SELECT panel_code, col_name, label, data_type, ref_panel, ref_field, place, seq, editable, hidden, visible, required
FROM yj_field WHERE col_name LIKE N'%仓位%' OR label LIKE N'%仓位%' OR col_name LIKE N'%库位%' OR label LIKE N'%库位%'
ORDER BY panel_code, seq, id;
GO
PRINT N'=== 2. 仓位 是否已落数 ===';
SELECT N'bd_purchase_in.仓位' AS 项, COUNT(*) AS 总行, SUM(CASE WHEN 仓位 IS NOT NULL AND LTRIM(RTRIM(仓位))<>N'' THEN 1 ELSE 0 END) AS 有值 FROM dbo.bd_purchase_in
UNION ALL SELECT N'bl_purchase_in.仓位编码', COUNT(*), SUM(CASE WHEN 仓位编码 IS NOT NULL AND LTRIM(RTRIM(仓位编码))<>N'' THEN 1 ELSE 0 END) FROM dbo.bl_purchase_in
UNION ALL SELECT N'bl_material_out.仓位名称', COUNT(*), SUM(CASE WHEN 仓位名称 IS NOT NULL AND LTRIM(RTRIM(仓位名称))<>N'' THEN 1 ELSE 0 END) FROM dbo.bl_material_out
UNION ALL SELECT N'bl_sale_out.仓位编码', COUNT(*), SUM(CASE WHEN 仓位编码 IS NOT NULL AND LTRIM(RTRIM(仓位编码))<>N'' THEN 1 ELSE 0 END) FROM dbo.bl_sale_out
UNION ALL SELECT N'bs_inv.默认仓位', COUNT(*), SUM(CASE WHEN 默认仓位 IS NOT NULL AND LTRIM(RTRIM(默认仓位))<>N'' THEN 1 ELSE 0 END) FROM dbo.bs_inv
UNION ALL SELECT N'bs_wh.库位', COUNT(*), SUM(CASE WHEN 库位 IS NOT NULL AND LTRIM(RTRIM(库位))<>N'' THEN 1 ELSE 0 END) FROM dbo.bs_wh
UNION ALL SELECT N'bs_wh.启用仓位管理', COUNT(*), SUM(CASE WHEN 启用仓位管理 = 1 THEN 1 ELSE 0 END) FROM dbo.bs_wh;
GO
PRINT N'=== 3. 有仓位的样例(非空前 10) ===';
SELECT TOP 10 单据编号, 仓位, 仓位编码 FROM dbo.bd_purchase_in WHERE 仓位 IS NOT NULL AND LTRIM(RTRIM(仓位))<>N'';
SELECT TOP 10 id, 仓位id, 仓位编码 FROM dbo.bl_purchase_in WHERE 仓位编码 IS NOT NULL AND LTRIM(RTRIM(仓位编码))<>N'';
SELECT TOP 10 存货编码, 默认仓位, 倒冲仓位编码 FROM dbo.bs_inv WHERE (默认仓位 IS NOT NULL AND LTRIM(RTRIM(默认仓位))<>N'') OR (倒冲仓位编码 IS NOT NULL AND LTRIM(RTRIM(倒冲仓位编码))<>N'');
GO
PRINT N'=== 4. kucun 全列 ===';
SELECT c.name AS 列, ty.name AS 类型 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.kucun') ORDER BY c.column_id;
GO
PRINT N'=== 5. inh / outh 全列 ===';
SELECT t.name AS 表, c.name AS 列 FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE t.name IN ('inh','outh') ORDER BY t.name, c.column_id;
GO
PRINT N'=== 6. 库位/仓位 相关对象 ===';
SELECT name, type_desc FROM sys.objects WHERE name LIKE N'%wh_loc%' OR name LIKE N'%仓位%' OR name LIKE N'%库位%' ORDER BY name;
GO
PRINT N'=== 7. bs_wh_loc 列 ===';
SELECT c.name AS 列, ty.name AS 类型 FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bs_wh_loc') ORDER BY c.column_id;
GO
