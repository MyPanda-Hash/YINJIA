-- _q-picklist-1014g.sql — 探针 v7:两套工单家族的数据实况(只读)
SET NOCOUNT ON;
SELECT N'plang(工单排产列表用的工单行)' AS 表, COUNT(*) AS 行数 FROM plang
UNION ALL SELECT N'plang_pc(工单排产)', COUNT(*) FROM plang_pc
UNION ALL SELECT N'bd_manu_order(生产工单面板头)', COUNT(*) FROM bd_manu_order
UNION ALL SELECT N'bl_manu_order(生产工单面板行)', COUNT(*) FROM bl_manu_order
UNION ALL SELECT N'bd_material_out(材料出库单头)', COUNT(*) FROM bd_material_out
UNION ALL SELECT N'bl_material_out(材料出库单行)', COUNT(*) FROM bl_material_out
UNION ALL SELECT N'bd_finish_in(产成品入库单头)', COUNT(*) FROM bd_finish_in
UNION ALL SELECT N'form_flow_link', COUNT(*) FROM form_flow_link
UNION ALL SELECT N'bs_inv(存货档案)', COUNT(*) FROM bs_inv;
PRINT '=== bd_manu_order 列 ===';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.bd_manu_order') ORDER BY c.column_id;
PRINT '=== bs_inv 列(前 25) ===';
SELECT TOP 25 c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.bs_inv') ORDER BY c.column_id;
