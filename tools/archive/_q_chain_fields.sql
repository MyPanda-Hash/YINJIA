-- _q_chain_fields.sql — 采购链四站面板字段现状(设计新增字段前的事实基线)
SET NOCOUNT ON;
PRINT '── PU_ORDER(采购订单) detail 字段 ──';
SELECT col_name, label, data_type, seq, editable, hidden, visible FROM yj_field
WHERE panel_code='PU_ORDER' AND place='detail' AND (col_name IN (N'行号',N'源单行号',N'源单编号',N'序号') OR hidden=0)
ORDER BY seq, col_name;
GO
PRINT '── SL_RECV(送料暂收单) header ──';
SELECT col_name, label, data_type, seq, hidden, visible FROM yj_field WHERE panel_code='SL_RECV' AND place LIKE '%header%' ORDER BY seq;
GO
PRINT '── SL_RECV detail ──';
SELECT col_name, label, data_type, seq, hidden, visible FROM yj_field WHERE panel_code='SL_RECV' AND place='detail' ORDER BY seq;
GO
PRINT '── QC_INSP(来料检验单) header ──';
SELECT col_name, label, data_type, seq, hidden, visible FROM yj_field WHERE panel_code='QC_INSP' AND place LIKE '%header%' ORDER BY seq;
GO
PRINT '── QC_INSP detail ──';
SELECT col_name, label, data_type, seq, hidden, visible FROM yj_field WHERE panel_code='QC_INSP' AND place='detail' ORDER BY seq;
GO
PRINT '── 各站物理表列:行号/订单/源单 相关 ──';
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('sl_recv','sl_recv_detail','qc_insp','qc_insp_detail','bd_purchase_in','bl_purchase_in','bd_pu_order','bl_pu_order')
  AND (COLUMN_NAME LIKE N'%行号%' OR COLUMN_NAME LIKE N'%订单%' OR COLUMN_NAME LIKE N'%源单%' OR COLUMN_NAME LIKE N'%序号%')
ORDER BY TABLE_NAME, COLUMN_NAME;
GO
