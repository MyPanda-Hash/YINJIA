SET NOCOUNT ON;
SELECT panel_code, panel_name, line_table, head_table FROM yj_panel WHERE panel_code IN ('QC_RECV','SL_RECV');
GO
SELECT COUNT(*) AS sl_recv_rows FROM sl_recv;
SELECT COUNT(*) AS qcrecv_fields FROM yj_field WHERE panel_code='QC_RECV';
GO
