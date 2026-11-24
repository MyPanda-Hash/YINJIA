SELECT 单据编号, 单据日期, 业务类型, 加工单号, 工单行号, 领用人, 部门编码, 部门id, 仓库, 备注
FROM dbo.bd_material_out WHERE 单据编号 = N'LL-2026-11-0047';
SELECT 行号, 材料编码, 材料名称, 仓库, 仓库编码, 批号, 数量, 计量单位
FROM dbo.bl_material_out WHERE 单据编号 = N'LL-2026-11-0047' ORDER BY TRY_CAST(行号 AS int);
SELECT 领料明细id, 物料编码, 仓库, 仓库编码, 批号, 数量, asp_cancel FROM dbo.wo_pick_batch WHERE 单头id = 856 ORDER BY id;
SELECT username, dept_id FROM dbo.yj_user WHERE username IN ('admin','liulei');
