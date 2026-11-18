SELECT panel_code, panel_name, table_name, line_table, doc_type, module_group, status FROM yj_panel WHERE panel_code IN ('ASM_BOM','RD_ASM_PROC','RD_MOLD_PROC','RD_X_SINTER','WLBOM','RD_PROD_INFO','RD_ASM_BOM','RD_MOLD_FORMULA');
SELECT panel_code, seq, place, col_name, label, data_type, required, hidden, visible, ref_panel, ref_field FROM yj_field WHERE panel_code IN ('ASM_BOM') ORDER BY seq
