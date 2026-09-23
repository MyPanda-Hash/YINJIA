SET NOCOUNT ON;
SELECT l.[单据编号], l.[存货编码], l.[仓库编码], l.[仓库], h.[仓库] AS 头仓库
  FROM bl_sale_out l LEFT JOIN bd_sale_out h ON h.[单据编号]=l.[单据编号]
 WHERE ISNULL(l.[仓库编码],'')<>'' AND NOT EXISTS (
   SELECT 1 FROM bs_wh w WHERE RTRIM(LTRIM(CAST(w.[仓库编码] AS nvarchar(200)))) = RTRIM(LTRIM(CAST(l.[仓库编码] AS nvarchar(200)))));
GO
