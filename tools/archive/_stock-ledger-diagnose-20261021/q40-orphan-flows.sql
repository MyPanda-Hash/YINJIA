SET NOCOUNT ON;
-- ① 三张"孤儿流水"单:行表 id 与 流水 rid 对不上,看是不是行被重建过
SELECT 单号 = 'SCLL-20260919-00013',
       行表行数 = (SELECT COUNT(*) FROM bl_material_out WHERE 单据编号 = 'SCLL-20260919-00013'),
       行表id = (SELECT CAST(MIN(id) AS nvarchar(10)) + '~' + CAST(MAX(id) AS nvarchar(10)) FROM bl_material_out WHERE 单据编号 = 'SCLL-20260919-00013'),
       流水行数 = (SELECT COUNT(*) FROM outh WHERE 单据编号 = 'SCLL-20260919-00013'),
       流水rid = (SELECT CAST(MIN(rid) AS nvarchar(10)) + '~' + CAST(MAX(rid) AS nvarchar(10)) FROM outh WHERE 单据编号 = 'SCLL-20260919-00013'),
       流水里能对上的行 = (SELECT COUNT(*) FROM outh f WHERE f.单据编号='SCLL-20260919-00013' AND EXISTS (SELECT 1 FROM bl_material_out l WHERE l.id = f.rid));

-- ② 这三张单是不是也落在"缺流水"的 418 张里?按单号看流水有效性
SELECT 单号, 行表行数, 流水行数, 有效流水 = 有效
FROM (
  SELECT h.单据编号 AS 单号,
         行表行数 = (SELECT COUNT(*) FROM bl_material_out l WHERE l.单据编号 = h.单据编号),
         流水行数 = (SELECT COUNT(*) FROM outh f WHERE f.单据编号 = h.单据编号),
         有效 = (SELECT COUNT(*) FROM outh f WHERE f.单据编号 = h.单据编号
                  AND EXISTS (SELECT 1 FROM bl_material_out l WHERE l.id = f.rid))
  FROM bd_material_out h
  WHERE h.单据编号 IN ('SCLL-20260919-00013','SCLL-20260919-00014','SCLL-20260920-00001')) x;

-- ③ 孤儿流水的总量
SELECT 孤儿流水行 = COUNT(*), 单据数 = COUNT(DISTINCT 单据编号), 数量合计 = SUM(数量)
FROM outh f WHERE f.src = 6 AND NOT EXISTS (SELECT 1 FROM bl_material_out l WHERE l.id = f.rid);
