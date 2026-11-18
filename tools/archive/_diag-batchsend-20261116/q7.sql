SET NOCOUNT ON;
PRINT '== who owns bl_pu_order ids 11039 11040 ==';
SELECT id, 单据编号, 行号, 物料编码, 数量, asp_cancel, asp_user1, asp_time1 FROM bl_pu_order WHERE id IN (11039,11040,11041,11042,11043,11044,11045,11046,11047,11048);
GO
PRINT '== all docs whose line ids are between 11035 and 11050 ==';
SELECT 单据编号, COUNT(*) AS n, MIN(id) AS minid, MAX(id) AS maxid FROM bl_pu_order WHERE id BETWEEN 11035 AND 11050 GROUP BY 单据编号;
GO
PRINT '== head of YJ-20261111-06 ==';
SELECT * FROM bd_pu_order WHERE 单据编号 = N'YJ-20261111-06';
