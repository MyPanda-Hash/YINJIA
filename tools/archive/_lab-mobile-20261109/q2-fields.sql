SET NOCOUNT ON;
PRINT '=== yj_field ===';
SELECT f.panel_code, f.id, f.seq, f.place, f.col_name, f.label, f.data_type, f.ref_panel, f.ref_field,
       f.visible, f.hidden, f.required, f.editable, f.tab_key
FROM yj_field f WHERE f.panel_code IN ('RD_SPIKE_WATER','RD_EQUIP_USE','RD_INSTR_USE')
ORDER BY f.panel_code, f.seq, f.id;
GO
