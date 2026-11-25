SET NOCOUNT ON;
PRINT '=== 1) 采购订单头 ===';
SELECT 单据编号, 项目, 供应商, 单据日期, 单据状态, 关闭状态, 数据来源, 外部单据号, 审核人, 审核时间
FROM bd_pu_order WHERE 单据编号 = N'YJ-20260921-10';

PRINT '=== 2) 采购订单行 ===';
SELECT id, 物料编码, 物料名称, 规格型号, 单位, 数量, 单价, 金额
FROM bl_pu_order WHERE 单据编号 = N'YJ-20260921-10' ORDER BY id;

PRINT '=== 3) form_flow_link 下游占用 ===';
SELECT id, source_line_key, target_panel_code, target_form_no, target_line_key,
       source_quantity, linked_quantity, link_status, batch_no, batch_id,
       create_by, create_time, release_time
FROM form_flow_link WHERE source_form_no = N'YJ-20260921-10' ORDER BY source_line_key, id;

PRINT '=== 4) 批次台账 yj_doc_batch ===';
SELECT id, batch_seq, batch_no, batch_qty, status, target_panel_code, target_form_no,
       create_time, release_time, remark
FROM yj_doc_batch WHERE source_form_no = N'YJ-20260921-10' ORDER BY id;
