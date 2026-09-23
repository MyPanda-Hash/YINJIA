SET NOCOUNT ON;
SELECT l.[存货编码], l.[存货名称], l.[计量单位], l.[单位id], l.[实收数量] 
  FROM bl_purchase_in l WHERE l.[单据编号] = N'PI-2026-09-0128' AND ISNULL(l.asp_cancel,'N')<>'Y';
GO
PRINT '== 订单行的单位(对照:那张推成功的订单) ==';
SELECT l.[物料编码], l.[单位], l.[单位id], l.[数量] FROM bl_pu_order l
 WHERE l.[单据编号] = N'YJ-20260909-01' AND ISNULL(l.asp_cancel,'N')<>'Y';
GO
