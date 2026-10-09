SET NOCOUNT ON;
SELECT panel_code, panel_name, module_group, mode FROM yj_panel
WHERE panel_code NOT IN ('QC_INSP','QC_TC_IN','QC_CATALOG','QC_INSP_REC','QC_INSP_REQ','QC_INSP_REQ_SERIES','QC_OP','QC_RECORD','QC_DISPOSAL','ROD_RETURN','LOT_TRACE','QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY')
  AND panel_code LIKE '%QC%' ORDER BY panel_code;
