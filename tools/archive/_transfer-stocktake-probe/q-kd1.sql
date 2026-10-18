SET NOCOUNT ON;
PRINT '=== erp_integ_api 里的调拨/盘点 ===';
SELECT 方向, 接口编码, 接口名称, 接口地址, 对应面板 FROM erp_integ_api WHERE 接口名称 LIKE N'%调拨%' OR 接口名称 LIKE N'%盘点%' OR 对应面板 IN ('TRANSFER','STOCKTAKE');
PRINT '=== 是否有金蝶调拨/盘点历史数据表 ===';
SELECT name FROM sys.tables WHERE name LIKE '%transfer%' OR name LIKE '%tfmove%' OR name LIKE '%check%' AND name LIKE 'bd_%';
