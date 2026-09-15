SET NOCOUNT ON;
SELECT h.id, h.[单据编号], h.[仓库] AS 头表仓库, l.[仓库] AS 行表仓库
FROM bd_material_out h LEFT JOIN bl_material_out l ON l.[单据编号]=h.[单据编号] ORDER BY h.id;
