SET NOCOUNT ON;
SELECT panel_code, panel_name FROM yj_panel WHERE panel_code IN ('SL_RECV','QC_BHC','QC_BHG','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY','QC_TC') ORDER BY panel_code;
