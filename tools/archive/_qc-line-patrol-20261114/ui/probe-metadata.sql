/* 巡线检验(QC_LINE_PATROL)元数据明细体检(只读):面板键 / 字段 / 授权 / 译名 */
SET NOCOUNT ON;

SELECT 'panel' AS obj, panel_code, panel_name, category, mode, head_table, line_table,
       group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group
FROM yj_panel WHERE panel_code = 'QC_LINE_PATROL';

SELECT 'fields_by_place' AS obj, place, COUNT(*) AS cnt, MIN(seq) AS minseq, MAX(seq) AS maxseq
FROM yj_field WHERE panel_code = 'QC_LINE_PATROL'
GROUP BY place ORDER BY place;

SELECT 'header_fields' AS obj, label, place, seq, hidden, visible, editable, required
FROM yj_field WHERE panel_code = 'QC_LINE_PATROL' AND (place LIKE '%header%' OR place = 'query')
ORDER BY seq;

SELECT 'detail_fields' AS obj, label, place, seq, hidden, visible, editable
FROM yj_field WHERE panel_code = 'QC_LINE_PATROL' AND place LIKE '%detail%'
ORDER BY seq;

SELECT 'role_panel' AS obj, COUNT(*) AS cnt FROM yj_role_panel WHERE panel_code = 'QC_LINE_PATROL';

SELECT 'translations' AS obj, scope, locale, COUNT(*) AS cnt
FROM yj_translation
WHERE ref_key IN ('成型车间巡线记录表','巡线时间','巡线人员','编号1','编号2','两液密度','表面状态','结果判定','长度标准1')
GROUP BY scope, locale ORDER BY scope, locale;
