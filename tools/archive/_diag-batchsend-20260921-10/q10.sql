SET NOCOUNT ON;
PRINT '=== A) 下游暂收单头 sl_recv ===';
SELECT id, 单据编号, 单据日期, 供应商, 单据状态, 审核人, 审核时间, 数量, 采购订单号, 批次号
FROM sl_recv WHERE 单据编号 = N'SL-2026-10-0053';

PRINT '=== B) 下游暂收单行 sl_recv_detail(按单据编号) ===';
SELECT id, 单据编号, 物料编码, 数量, 批次号, 采购单号, 采购订单行号, 入库数量, 退料数量
FROM sl_recv_detail WHERE 单据编号 = N'SL-2026-10-0053' ORDER BY id;

PRINT '=== C) link 指向的下游行是否真实存在(348/349/350) ===';
SELECT id, 单据编号, 物料编码, 数量 FROM sl_recv_detail WHERE id IN (348,349,350);

PRINT '=== D) 该订单全部 link(不限来源单号写法) ===';
SELECT id, source_form_no, source_line_key, target_panel_code, target_form_no, target_line_key,
       linked_quantity, link_status, batch_no, create_time, release_time
FROM form_flow_link
WHERE source_form_no LIKE N'YJ-20260921-10%' OR target_form_no = N'SL-2026-10-0053'
ORDER BY source_line_key, id;

PRINT '=== E) 材料码打印记录 bl_pu_label(单据编号=订单号) ===';
SELECT id, 单据编号, 采购订单行号, 采购订单行id, 物料编码, 打印数量, 补登, 去向单据, asp_user1, asp_time1
FROM bl_pu_label WHERE 单据编号 = N'YJ-20260921-10' ORDER BY id;
