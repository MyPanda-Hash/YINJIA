SET NOCOUNT ON;
SELECT dh, lb, ny, asp_user1, CONVERT(nvarchar(19),asp_time1,120) AS 取号时间
FROM s_allno WHERE dh LIKE N'LL-[0-9][0-9][0-9][0-9]-[0-9][0-9]-%' ORDER BY dh;
SELECT 单据编号, CONVERT(nvarchar(10),单据日期,120) AS 单据日期, 加工单号, CONVERT(nvarchar(19),asp_time1,120) AS 创建时间
FROM bd_material_out WHERE 单据编号 LIKE N'LL-%' ORDER BY id;
