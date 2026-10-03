SET NOCOUNT ON;
GO
PRINT '=== PU_ORDER 面板字段里与批次/打印有关的 ===';
SELECT panel_code, place, seq, label, col_name, data_type, editable, visible, hidden
FROM yj_field WHERE panel_code = N'PU_ORDER' AND (label LIKE N'%批次%' OR label LIKE N'%打印%' OR label LIKE N'%数量%')
ORDER BY place, seq;
GO
PRINT '=== bl_pu_order 是否有 批次号 列 + 是否有值 ===';
SELECT COL_LENGTH('dbo.bl_pu_order', N'批次号') AS 列长;
GO
SELECT COUNT(*) AS 行数, SUM(CASE WHEN ISNULL([批次号],N'')<>N'' THEN 1 ELSE 0 END) AS 有批次号的行
FROM bl_pu_order;
GO
PRINT '=== 引用了 bl_pu_order.[批次号] 的对象 ===';
SELECT o.name, o.type_desc FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%bl_pu_order%' AND m.definition LIKE N'%批次号%';
GO
PRINT '=== 采购订单头/行的关键列(供方案引用) ===';
SELECT t.name AS tbl, c.name AS col, ty.name AS typ, c.max_length
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN (N'bd_pu_order', N'bl_pu_order')
  AND c.name IN (N'单据编号', N'行号', N'物料编码', N'物料名称', N'数量', N'计量单位', N'单位', N'批次号', N'供应商编码', N'入库数量', N'结案')
ORDER BY t.name, c.column_id;
GO
PRINT '=== 现有 yj_app_setting(超送比例等) ===';
SELECT setting_key, setting_value FROM yj_app_setting;
GO
