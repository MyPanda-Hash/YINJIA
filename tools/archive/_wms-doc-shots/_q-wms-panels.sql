-- _q-wms-panels.sql — 为「附件一 智慧工厂系统明细清单」WMS 部分找本地真实页面对应(2026-10-05)
-- 用法(tools 目录下): java -cp lib\mssql-jdbc.jar SqlRunner.java "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia env archive\_q-wms-panels.sql
SET NOCOUNT ON;
GO
PRINT '=== 1) 面板名含 仓/库/条码/入库/出库 ===';
GO
SELECT panel_code, panel_name, line_table, detail_key, module_group
FROM yj_panel
WHERE panel_name LIKE N'%仓%' OR panel_name LIKE N'%库%' OR panel_name LIKE N'%条码%'
   OR panel_name LIKE N'%入库%' OR panel_name LIKE N'%出库%'
ORDER BY panel_name;
GO
PRINT '=== 2) 物料类别字典值(是否含半成品/成品/材料仓概念) ===';
GO
SELECT * FROM yj_dict_item WHERE dict_code IN (SELECT dict_code FROM yj_dict WHERE dict_name LIKE N'%物料类别%') ORDER BY seq;
GO
PRINT '=== 3) 库存类报表/台账面板行数 ===';
GO
SELECT panel_code, panel_name, line_table, detail_key FROM yj_panel
WHERE panel_code IN ('STOCK_BALANCE','STOCK_LEDGER','STOCK_SUMMARY','WH','WHLOC','INV','PURCHASE_IN','FINISH_IN','MATERIAL_OUT','SALE_OUT','ERPLG')
ORDER BY panel_code;
GO
PRINT '=== 4) 各库存表行数 ===';
GO
SELECT 'bs_inv' t, COUNT(*) n FROM bs_inv
UNION ALL SELECT 'wh', COUNT(*) FROM wh
UNION ALL SELECT 'bl_purchase_in', COUNT(*) FROM bl_purchase_in
UNION ALL SELECT 'bl_finish_in', COUNT(*) FROM bl_finish_in
UNION ALL SELECT 'bl_material_out', COUNT(*) FROM bl_material_out
UNION ALL SELECT 'bl_sale_out', COUNT(*) FROM bl_sale_out;
GO
