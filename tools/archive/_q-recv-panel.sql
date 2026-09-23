SET NOCOUNT ON;
PRINT '== yj_panel 三单指向 ==';
SELECT panel_code, panel_name, line_table, head_table FROM yj_panel
 WHERE panel_code IN ('QC_RECV','SL_RECV','QC_RETURN','QC_INSP') ORDER BY panel_code;
GO
PRINT '== 行数对照 ==';
SELECT 'sl_recv' AS t, COUNT(*) AS n FROM sl_recv
UNION ALL SELECT 'sl_recv_detail', COUNT(*) FROM sl_recv_detail;
GO
