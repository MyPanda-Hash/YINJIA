SET NOCOUNT ON;
SELECT panel_code, panel_name, head_table, line_table, mode, category FROM yj_panel WHERE panel_code IN ('QC_FIRST_INSP','QC_PROC_INSP');
PRINT '--- fields';
SELECT label, col_name, data_type, editable, visible, hidden, place, seq
FROM yj_field WHERE panel_code='QC_FIRST_INSP' ORDER BY seq, id;
PRINT '--- head cols 审核/审批/检验员';
SELECT name, TYPE_NAME(user_type_id) AS t, max_length FROM sys.columns
WHERE object_id = OBJECT_ID('qc_first_insp_head') AND (name LIKE '%审核%' OR name LIKE '%审批%' OR name LIKE '%检验员%');
PRINT '--- doc status';
SELECT ISNULL(archived,'N') AS archived, COUNT(*) c FROM yj_doc_status WHERE panel_code='QC_FIRST_INSP' GROUP BY ISNULL(archived,'N');
PRINT '--- approver/auditor fill';
SELECT COUNT(*) AS total, SUM(CASE WHEN 审批人 IS NOT NULL AND 审批人<>'' THEN 1 ELSE 0 END) AS with_approver,
       SUM(CASE WHEN 审核人 IS NOT NULL AND 审核人<>'' THEN 1 ELSE 0 END) AS with_auditor FROM qc_first_insp_head;
PRINT '--- button tables';
SELECT name FROM sys.tables WHERE name LIKE '%button%';
