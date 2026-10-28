SET NOCOUNT ON;
SELECT (SELECT COUNT(1) FROM bs_dc_gateway WHERE ISNULL(asp_cancel,'N')<>'Y') AS 正式网关数,
       (SELECT COUNT(1) FROM bs_dc_device  WHERE ISNULL(asp_cancel,'N')<>'Y') AS 正式设备数,
       (SELECT COUNT(1) FROM bs_dc_device  WHERE ISNULL(asp_cancel,'N')<>'Y' AND gateway_id IS NOT NULL) AS 正式已绑定;
GO
