SET NOCOUNT ON;
SELECT COUNT(*) AS bs_qc_item行数 FROM bs_qc_item;
GO
SELECT TOP 15 * FROM bs_qc_item;
GO
SELECT COUNT(*) AS bs_qc_plan行数 FROM bs_qc_plan;
GO
SELECT TOP 10 * FROM bs_qc_plan;
GO
SELECT place, col_name, label, ref_panel, ref_field, display_field, hidden
FROM yj_field WHERE panel_code IN ('QC_ITEM','QC_PLAN') ORDER BY panel_code, seq;
GO
