SET NOCOUNT ON;
SELECT l.存货编码, LEFT(l.存货名称,12) AS 名称, l.规格型号 FROM bl_purchase_in l WHERE l.存货编码 IN ('YJ-XWR-003','YJ-SX-031','YJ-SX-035','YJ-SX-002-2') GROUP BY l.存货编码, l.存货名称, l.规格型号;
