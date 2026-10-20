SET NOCOUNT ON;
SELECT id, 单据编号, 单据日期, 业务类型, 仓库, 加工单号, 工单行号, 单据状态, asp_cancel
  FROM dbo.bd_material_out WHERE 单据编号 = N'SCLL-20260919-00013';
GO
SELECT id, 单据编号, 加工单号, 材料编码, 批号, 数量 FROM dbo.bl_material_out WHERE 单据编号 = N'SCLL-20260919-00013';
GO
SELECT TOP 5 id, 单据编号, 加工单号, 材料编码, 批号, 数量 FROM dbo.bl_material_out WHERE id = 1168;
