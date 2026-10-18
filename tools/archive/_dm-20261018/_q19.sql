SET NOCOUNT ON;
SELECT p.panel_code, p.line_table, p.head_table FROM yj_panel p WHERE p.panel_code LIKE '%PROC%' OR p.panel_code LIKE '%QC%' ORDER BY p.panel_code;
