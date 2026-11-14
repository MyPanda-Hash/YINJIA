-- C3 巡线检验 DB 复核(单库执行;两账套各跑一次)
SELECT 'tables' AS chk, name FROM sys.tables WHERE name IN ('qc_line_patrol_head','qc_line_patrol_detail') ORDER BY name;

SELECT 'panel' AS chk, panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group
FROM yj_panel WHERE panel_code = 'QC_LINE_PATROL';

SELECT 'field_total' AS chk, COUNT(*) AS n FROM yj_field WHERE panel_code = 'QC_LINE_PATROL';

SELECT 'field_place' AS chk, place, COUNT(*) AS n FROM yj_field WHERE panel_code = 'QC_LINE_PATROL' GROUP BY place ORDER BY place;

SELECT 'field_rows' AS chk, seq, col_name, label, place, visible, hidden, editable, required
FROM yj_field WHERE panel_code = 'QC_LINE_PATROL' ORDER BY place, seq, id;

SELECT 'role_panel' AS chk, COUNT(*) AS n FROM yj_role_panel WHERE panel_code = 'QC_LINE_PATROL';

SELECT 'role_panel_rows' AS chk, * FROM yj_role_panel WHERE panel_code = 'QC_LINE_PATROL';

SELECT 'trans_panel' AS chk, locale, text FROM yj_translation WHERE scope='panel' AND ref_key=N'成型车间巡线记录表' ORDER BY locale;

SELECT 'trans_field_missing_en' AS chk, COUNT(*) AS n
FROM yj_field f
WHERE f.panel_code='QC_LINE_PATROL'
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en');

SELECT 'trans_field_missing_en_rows' AS chk, f.col_name, f.label
FROM yj_field f
WHERE f.panel_code='QC_LINE_PATROL'
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key=f.label AND t.locale='en');

SELECT 'trans_field_en' AS chk, ref_key, text FROM yj_translation
WHERE scope='field' AND locale='en' AND ref_key IN (
  SELECT label FROM yj_field WHERE panel_code='QC_LINE_PATROL'
) ORDER BY ref_key;

SELECT 'cols_head' AS chk, name FROM sys.columns WHERE object_id = OBJECT_ID('qc_line_patrol_head') ORDER BY column_id;

SELECT 'cols_detail' AS chk, name FROM sys.columns WHERE object_id = OBJECT_ID('qc_line_patrol_detail') ORDER BY column_id;

SELECT 'ms_desc_tables' AS chk, COUNT(*) AS n FROM sys.extended_properties
WHERE major_id IN (OBJECT_ID('qc_line_patrol_head'), OBJECT_ID('qc_line_patrol_detail')) AND minor_id = 0;

SELECT 'ms_desc_cols' AS chk, COUNT(*) AS n FROM sys.extended_properties
WHERE major_id IN (OBJECT_ID('qc_line_patrol_head'), OBJECT_ID('qc_line_patrol_detail')) AND minor_id > 0;

SELECT 'schema_log' AS chk, COUNT(*) AS n FROM yj_schema_log WHERE script_name LIKE '%qc-line-patrol%';

SELECT 'data_rows' AS chk
, (SELECT COUNT(*) FROM qc_line_patrol_head) AS head_rows
, (SELECT COUNT(*) FROM qc_line_patrol_detail) AS detail_rows
