-- 探针:兄弟单据行表的价税列惯例 + 材料出库单转ERP 前置列
SET NOCOUNT ON;
PRINT '=== A. 各单据行表中含 价/税/金额/成本/税率 的列 ===';
SELECT t.name AS 表, c.name AS 列, TYPE_NAME(c.system_type_id) AS 类型, c.precision AS 精度, c.scale AS 小数位
FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
WHERE t.name IN ('bl_purchase_in','bl_sale_out','bl_finish_in','bl_other_out','bl_material_out','bl_outsource_in','bl_outsource_issue','bl_other_in')
  AND (c.name LIKE N'%价%' OR c.name LIKE N'%税%' OR c.name LIKE N'%金额%' OR c.name LIKE N'%成本%' OR c.name LIKE N'%折扣%' OR c.name LIKE N'%单位%')
ORDER BY t.name, c.column_id;
PRINT '=== B. 采购入库行全列(对照同一套价税写法) ===';
SELECT c.column_id, c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_purchase_in') ORDER BY c.column_id;
PRINT '=== C. 采购入库头全列 ===';
SELECT c.column_id, c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_purchase_in') ORDER BY c.column_id;
PRINT '=== D. 材料出库头/行 行数(正式库) ===';
SELECT (SELECT COUNT(*) FROM bd_material_out) AS 头, (SELECT COUNT(*) FROM bl_material_out) AS 行;
PRINT '=== E. bd_material_out 是否已有转ERP列 ===';
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_material_out') AND name LIKE N'%ERP%';
PRINT '=== F. 面板字段表名确认 ===';
SELECT name FROM sys.tables WHERE name LIKE 'yj_%' ORDER BY name;
GO
