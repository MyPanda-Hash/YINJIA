SELECT DB_NAME() AS db_name;

SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'yj_schema_log'
ORDER BY ORDINAL_POSITION;

SELECT OBJECT_ID('bs_mix_bom') AS bs_mix_bom_oid,
       (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bs_mix_bom') AS bs_mix_bom_cols,
       (SELECT COUNT(*) FROM bs_mix_bom) AS bs_mix_bom_rows;

SELECT panel_code, panel_name, module_group FROM yj_panel WHERE panel_code='MIX_BOM';

SELECT COUNT(*) AS mix_bom_field_rows,
       SUM(CASE WHEN visible=1 THEN 1 ELSE 0 END) AS visible_rows,
       SUM(CASE WHEN required=1 THEN 1 ELSE 0 END) AS required_rows
FROM yj_field WHERE panel_code='MIX_BOM';

SELECT scope, ref_key, locale, text, source
FROM yj_translation
WHERE (scope='panel' AND ref_key='混料物料清单')
ORDER BY locale;

SELECT COUNT(*) AS field_i18n_rows
FROM yj_translation
WHERE scope='field' AND ref_key IN ('产品编号','物料编码','数量','单号')
