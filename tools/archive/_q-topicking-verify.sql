-- _q-topicking-verify.sql — 转领料单:测试账套落库核对(只读)
SET NOCOUNT ON;
PRINT '=== 1) 生成的领料单(材料出库单)单头 ===';
SELECT 单据编号, 单据日期, 业务类型, 出库类别, 生产车间, 领用人, 仓库, 来源单据, 来源单号, 加工单号, 单据状态, 备注
FROM bd_material_out ORDER BY id DESC;

PRINT '=== 2) 明细行数(应为 0:按用户口径明细留空由仓库补) ===';
SELECT h.单据编号, COUNT(l.id) AS 明细行数
FROM bd_material_out h LEFT JOIN bl_material_out l ON l.单据编号 = h.单据编号
GROUP BY h.单据编号 ORDER BY h.单据编号 DESC;

PRINT '=== 3) 占用链(PLANG→MATERIAL_OUT,应 ACTIVE) ===';
SELECT source_panel_code, source_form_no, source_line_key, target_panel_code, target_form_no, inventory_code,
       source_quantity, linked_quantity, link_status
FROM form_flow_link WHERE source_panel_code = N'PLANG' ORDER BY id DESC;

PRINT '=== 4) 工单侧现状(领料单号应为空:未审核不写回,与回写口径一致) ===';
SELECT pl_no, pl_xc, [批次号], ISNULL(pl_sl,0) AS 排产数量, ISNULL(ll_no2,N'') AS 领料单号, ja
FROM plang WHERE pl_no = N'MO-2026-09-0007' ORDER BY pl_xc;
