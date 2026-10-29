/* 验收:移动端扫码领料生成的草稿单是否带了 工单键 / 仓库 / 仓位 / 批号 */
SET NOCOUNT ON;

SELECT TOP 3 h.id, h.单据编号, h.单据日期, h.业务类型, h.仓库, h.加工单号, h.工单行号,
       h.单据状态, h.备注, h.asp_user1
  FROM dbo.bd_material_out h
 WHERE h.加工单号 = N'GD-TEST-MP01' ORDER BY h.id DESC;

SELECT TOP 5 l.id, l.单据编号, l.材料编码, l.材料名称, l.计量单位, l.数量, l.单价, l.金额,
       l.批号, l.仓库, l.仓库编码, l.仓位编码, l.仓位名称, l.行号
  FROM dbo.bl_material_out l
 WHERE l.加工单号 = N'GD-TEST-MP01' ORDER BY l.id DESC;
