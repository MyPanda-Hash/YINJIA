SET NOCOUNT ON;
SELECT TOP 6 单据编号, 材料编码, 数量, 明细备注 FROM bl_material_out WHERE ISNULL(明细备注,'') LIKE '%领料批次%' ORDER BY id DESC;
GO
SELECT COUNT(*) 仍缺需求 FROM bl_material_out l JOIN bd_material_out h ON h.单据编号=l.单据编号
 WHERE ISNULL(l.asp_cancel,'N')<>'Y' AND ISNULL(h.加工单号,'') LIKE 'GD-%'
   AND ISNULL(l.明细备注,'') NOT LIKE '%(需求 %' AND ISNULL(l.明细备注,'') LIKE '%领料批次%';
