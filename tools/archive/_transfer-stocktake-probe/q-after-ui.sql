SET NOCOUNT ON;
SELECT [单据编号], [业务类型], [备注], asp_cancel FROM bd_transfer ORDER BY id;
PRINT '=== 调拨行 ===';
SELECT l.[单据编号], l.[存货编码], l.[批号], l.[调出仓库], l.[调出仓库编码], l.[调入仓库], l.[数量] FROM bl_transfer l ORDER BY l.id;
PRINT '=== 盘点单 ===';
SELECT [单据编号], [业务类型], [盘点类型], asp_cancel FROM bd_stocktake ORDER BY id;
SELECT l.[单据编号], l.[存货编码], l.[批号], l.[仓库], l.[账面数量], l.[实盘数量], l.[差异数量] FROM bl_stocktake l ORDER BY l.id;
