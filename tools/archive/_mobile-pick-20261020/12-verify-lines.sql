SET NOCOUNT ON;
SELECT l.单据编号, l.行号, l.材料编码, l.材料名称, l.计量单位, l.数量, l.单价, l.金额,
       l.批号, l.仓库, l.仓库编码, l.仓位编码, l.仓位名称, l.加工单号
  FROM dbo.bl_material_out l
 WHERE l.单据编号 IN (N'LL-2026-10-0002') ORDER BY l.id;
