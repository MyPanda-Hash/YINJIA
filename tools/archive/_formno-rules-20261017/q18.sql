SET NOCOUNT ON;
PRINT '== LL2610170002 在哪些表出现(含已作废) ==';
SELECT N'bd_material_out' AS t, 单据编号 AS no, ISNULL(asp_cancel,'N') AS cancel, asp_user1
FROM bd_material_out WHERE 单据编号 LIKE N'LL%'
UNION ALL SELECT N'bl_material_out', 单据编号, ISNULL(asp_cancel,'N'), asp_user1 FROM bl_material_out WHERE 单据编号 LIKE N'LL%';
PRINT '== 材料出库单 CL 号按月分布 ==';
SELECT SUBSTRING(单据编号, 4, 7) AS ym, COUNT(*) AS n FROM bd_material_out
WHERE 单据编号 LIKE N'CL-%' AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY SUBSTRING(单据编号, 4, 7) ORDER BY ym;
