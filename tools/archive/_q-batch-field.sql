SET NOCOUNT ON;
SELECT '批次号字段注册情况' AS t, panel_code, place, seq, visible FROM yj_field
WHERE col_name = N'批次号' AND panel_code IN ('SL_RECV','QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN')
ORDER BY panel_code, place;
SELECT '面板是否存在' AS t, panel_code, panel_name FROM yj_panel WHERE panel_code IN ('SL_RECV','QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN');
SELECT '批次号列' AS t, TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME = N'批次号' AND TABLE_NAME IN ('sl_recv','sl_recv_detail','qc_recv','qc_recv_detail','qc_insp','qc_insp_detail','qc_return','qc_return_detail','bd_purchase_in','bl_purchase_in');
