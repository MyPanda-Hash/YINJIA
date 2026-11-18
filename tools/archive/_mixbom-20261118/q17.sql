SELECT panel_code, panel_name, mode, line_table, group_col, pk_col, code_col, prefix, module_group, config FROM yj_panel WHERE panel_code='MIX_BOM';
SELECT seq, place, col_name, label, data_type, required, editable, hidden, visible FROM yj_field WHERE panel_code='MIX_BOM' ORDER BY seq, id;
SELECT COUNT(*) trs FROM yj_translation WHERE scope='panel' AND ref_key=N'混料物料清单';
SELECT COUNT(*) perms FROM yj_role_panel WHERE panel_code='MIX_BOM';
SELECT COUNT(*) cols FROM sys.columns WHERE object_id=OBJECT_ID('bs_mix_bom');
SELECT COUNT(*) commented FROM sys.extended_properties WHERE major_id=OBJECT_ID('bs_mix_bom') AND name='MS_Description';
