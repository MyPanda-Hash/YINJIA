SELECT 单据编号, 业务类型, 加工单号, 工单行号, 领用人, 部门编码, 部门id, 备注
FROM dbo.bd_material_ret WHERE 单据编号 = N'TL-2026-11-0021';
SELECT 行号, 材料编码, 仓库, 仓库编码, 批号, 数量, 明细备注
FROM dbo.bl_material_ret WHERE 单据编号 = N'TL-2026-11-0021' ORDER BY TRY_CAST(行号 AS int);
SELECT 领料单号, 物料编码, 仓库, 批号, 退料数量, 退料单号, 退料人
FROM dbo.wo_pick_return WHERE 领料单号 = N'LL-2026-11-0047' ORDER BY id;
SELECT 领料单号, 退料单号, 状态 FROM dbo.wo_pick_doc WHERE id = 856;
