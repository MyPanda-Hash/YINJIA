SET NOCOUNT ON;
SELECT panel_code, head_table, line_table, group_col, prefix, LEN(group_col) lg FROM yj_panel WHERE panel_code IN ('QC_RECV','QC_INSP');
SELECT 单据编号, COUNT(*) n FROM sl_recv GROUP BY 单据编号 HAVING COUNT(*)>1;
