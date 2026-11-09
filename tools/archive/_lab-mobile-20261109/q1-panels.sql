SET NOCOUNT ON;
PRINT '=== yj_panel rows ===';
SELECT panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, detail_key, module_group, config
FROM yj_panel WHERE panel_code IN ('RD_SPIKE_WATER','RD_EQUIP_USE','RD_INSTR_USE','RD_DOM_TEST','RD_FILTER_EFF')
ORDER BY panel_code;
GO
PRINT '=== yj_field ===';
SELECT f.panel_code, f.seq, f.place, f.col_name, ISNULL(f.label,'') label, f.deptype, f.visible, f.hidden, f.required
FROM yj_field f WHERE f.panel_code IN ('RD_SPIKE_WATER','RD_EQUIP_USE','RD_INSTR_USE')
ORDER BY f.panel_code, f.seq;
GO
