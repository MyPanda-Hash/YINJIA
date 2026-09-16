SET NOCOUNT ON;
-- 8类出入库单据的数据量全景
SELECT N'采购入库' AS 面板, (SELECT COUNT(*) FROM bd_purchase_in) AS 头, (SELECT COUNT(*) FROM bl_purchase_in) AS 行
UNION ALL SELECT N'产成品入库', (SELECT COUNT(*) FROM bd_finish_in), (SELECT COUNT(*) FROM bl_finish_in)
UNION ALL SELECT N'其他入库', (SELECT COUNT(*) FROM bd_other_in), (SELECT COUNT(*) FROM bl_other_in)
UNION ALL SELECT N'委外入库', (SELECT COUNT(*) FROM bd_outsource_in), (SELECT COUNT(*) FROM bl_outsource_in)
UNION ALL SELECT N'销售出库', (SELECT COUNT(*) FROM bd_sale_out), (SELECT COUNT(*) FROM bl_sale_out)
UNION ALL SELECT N'材料出库', (SELECT COUNT(*) FROM bd_material_out), (SELECT COUNT(*) FROM bl_material_out)
UNION ALL SELECT N'其他出库', (SELECT COUNT(*) FROM bd_other_out), (SELECT COUNT(*) FROM bl_other_out)
UNION ALL SELECT N'委外发料', (SELECT COUNT(*) FROM bd_outsource_issue), (SELECT COUNT(*) FROM bl_outsource_issue);
-- 金蝶沙箱里各类单据的量
