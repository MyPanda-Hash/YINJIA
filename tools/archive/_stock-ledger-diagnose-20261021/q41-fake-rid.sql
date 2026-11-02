SET NOCOUNT ON;
SELECT f.rid, f.单据编号, f.物料编码, 批号 = ISNULL(f.批号,'<NULL>'), f.数量,
       写入者 = f.asp_user1, 写入时间 = CONVERT(char(19), f.asp_time1, 120), 标记 = f.asp_user2,
       行表里有这个id = CASE WHEN EXISTS (SELECT 1 FROM bl_material_out l WHERE l.id = f.rid) THEN '有' ELSE '没有' END
FROM outh f
WHERE f.src = 6 AND f.rid >= 900000000
ORDER BY f.单据编号, f.rid;

SELECT 假rid行 = COUNT(*), 最小rid = MIN(rid), 最大rid = MAX(rid),
       写入者 = MIN(asp_user1) + ' / ' + ISNULL(MIN(asp_user2),''), 写入时间 = MIN(CONVERT(char(19), asp_time1, 120))
FROM outh WHERE rid >= 900000000;
