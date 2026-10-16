/* _q-head-cols.sql —— 首件检验单头/明细列(找审核签署相关列,判断审核动作是否还要回写纸面格) */
SET NOCOUNT ON;
PRINT N'-- qc_first_insp_head 列';
SELECT c.column_id, c.name, t.name AS type_name, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'qc_first_insp_head') ORDER BY c.column_id;
PRINT N'-- qc_first_insp_detail 列';
SELECT c.column_id, c.name, t.name AS type_name, c.max_length, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'qc_first_insp_detail') ORDER BY c.column_id;
PRINT N'-- QC_FIRST_INSP 表头(yj_field place 含 header 或 =query)字段,按 seq';
SELECT seq, col_name, label, place, visible, hidden, editable
FROM yj_field WHERE panel_code = N'QC_FIRST_INSP' AND (place LIKE N'%header%' OR place = N'query')
ORDER BY seq, id;
