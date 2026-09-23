SET NOCOUNT ON;
PRINT '== bd_pu_order 转ERP/供应商 列 ==';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('bd_pu_order')
  AND (c.name LIKE N'%转ERP%' OR c.name LIKE N'%ERP%' OR c.name LIKE N'%供应商%' OR c.name LIKE N'%单据日期%' OR c.name = N'备注') ORDER BY c.column_id;
GO
PRINT '== bl_pu_order 数量/单价/存货 列 ==';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('bl_pu_order')
  AND c.name IN (N'存货编码', N'物料编码', N'数量', N'单价', N'计量单位', N'规格型号', N'税率%', N'单位id', N'仓库', N'行号') ORDER BY c.column_id;
GO
PRINT '== 订单 YJ-20260909-01 头行数据 ==';
SELECT TOP 3 h.[单据编号], h.[单据日期], h.[供应商], h.[供应商编码], h.[备注] FROM bd_pu_order h WHERE h.[单据编号]=N'YJ-20260909-01';
SELECT TOP 5 l.[行号], l.[物料编码], l.[物料名称], l.[数量], l.[单价], l.[计量单位], l.[规格型号] FROM bl_pu_order l WHERE l.[单据编号]=N'YJ-20260909-01' AND ISNULL(l.asp_cancel,'N')<>'Y';
GO
