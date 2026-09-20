-- _q_qc_fields.sql — QC_INSP 明细 单价/计量单位 的字段注册现状(链路带值靠标签存在)
SET NOCOUNT ON;
PRINT '── QC_INSP detail 字段注册 ──';
SELECT col_name, label, data_type, seq, editable, hidden, visible FROM yj_field
WHERE panel_code='QC_INSP' AND place='detail' ORDER BY seq, col_name;
GO
PRINT '── QC_INSP 头字段注册 ──';
SELECT col_name, label, seq, hidden, visible FROM yj_field WHERE panel_code='QC_INSP' AND place LIKE '%header%' ORDER BY seq;
GO
PRINT '── SL_RECV detail 字段注册 ──';
SELECT col_name, label, data_type, seq, editable, hidden, visible FROM yj_field
WHERE panel_code='SL_RECV' AND place='detail' ORDER BY seq, col_name;
GO
PRINT '── 待补列的物理存在性 ──';
SELECT 'qc_insp_detail.单价' AS 项, (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp_detail' AND COLUMN_NAME=N'单价') AS n
UNION ALL SELECT 'qc_insp_detail.计量单位', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp_detail' AND COLUMN_NAME=N'计量单位')
UNION ALL SELECT 'sl_recv_detail.计量单位', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sl_recv_detail' AND COLUMN_NAME=N'计量单位')
UNION ALL SELECT 'sl_recv_detail.单价', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sl_recv_detail' AND COLUMN_NAME=N'单价')
UNION ALL SELECT 'bl_purchase_in.计量单位', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bl_purchase_in' AND COLUMN_NAME=N'计量单位');
GO
