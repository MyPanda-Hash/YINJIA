SET NOCOUNT ON;
SELECT 单据编号, CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN N'已作废(软删)' ELSE N'有效' END AS 状态, 备注 FROM bd_material_out ORDER BY id;
GO
SELECT '有效头' AS k, COUNT(*) AS n FROM bd_material_out WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT '有效行', COUNT(*) FROM bl_material_out WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
