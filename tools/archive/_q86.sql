SET NOCOUNT ON;
SELECT 存货编码, LEFT(存货名称,12) AS 名称, 规格型号 FROM bs_inv WHERE 存货编码 IN ('YJ-XWR-003','YJ-SX-031','YJ-SX-035','YJ-SX-002-2');
