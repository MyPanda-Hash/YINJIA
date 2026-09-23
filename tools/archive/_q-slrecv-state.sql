SET NOCOUNT ON;
SELECT panel_code, panel_name, line_table FROM yj_panel WHERE panel_code IN ('SL_RECV','QC_RECV') ;
GO
