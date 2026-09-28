SET NOCOUNT ON;
SELECT 'bd_material_out' AS t, COUNT(*) AS n FROM bd_material_out
UNION ALL SELECT 'bl_material_out', COUNT(*) FROM bl_material_out
UNION ALL SELECT 'yj_doc_status(MATERIAL_OUT)', COUNT(*) FROM yj_doc_status WHERE panel_code='MATERIAL_OUT';
GO
SELECT TOP 5 单据编号, 单据日期, 业务类型, 生产车间, 仓库, 领用人, 单据状态 FROM bd_material_out ORDER BY id;
GO
SELECT TOP 5 单据编号, 材料编码, 材料名称, 计量单位, 数量, 单价, 仓库, 批号 FROM bl_material_out ORDER BY id;
GO
SELECT doc_no, status, shr, canceled FROM yj_doc_status WHERE panel_code='MATERIAL_OUT';
GO
SELECT TOP 8 存货编码, 存货名称, 计量单位 FROM bs_inv WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id;
GO
SELECT TOP 8 仓库编码, 仓库名称 FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id;
GO
