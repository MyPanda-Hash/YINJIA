SET NOCOUNT ON;
-- 统计:备注里已无「(需求 N)」但属于本功能的领料行
SELECT COUNT(*) 丢失需求的行 FROM bl_material_out
 WHERE ISNULL(明细备注,'') NOT LIKE '%(需求 %'
   AND ISNULL(明细备注,'') LIKE '%领料批次%';
GO
SELECT TOP 5 单据编号, 材料编码, 数量, 明细备注 FROM bl_material_out WHERE ISNULL(明细备注,'') LIKE '%领料批次%';
