SET NOCOUNT ON;
GO
SELECT N'S1-45: 四文件 header 字段(仅表头,查文件编码)' AS sec,
       panel_code, seq, col_name, label, data_type, editable, required, hidden
FROM yj_field WHERE panel_code IN ('RD_SPEC_DOC','RD_ASM_PROC','RD_INSP_PLAN','RD_ASM_BOM')
  AND place='header' ORDER BY panel_code, seq;
GO
SELECT N'S1-46: RD_SPEC_DOC 全部字段(place 分组计数)' AS sec, place, COUNT(*) AS n
FROM yj_field WHERE panel_code LIKE 'RD%' GROUP BY place ORDER BY place;
GO
SELECT N'S1-47: RD_SPEC_DOC 全部字段' AS sec, seq, col_name, label, data_type, place, editable, visible
FROM yj_field WHERE panel_code='RD_SPEC_DOC' ORDER BY place, seq;
GO
SELECT N'S1-48: RD_INSP_PLAN 全部字段' AS sec, seq, col_name, label, data_type, place, editable, visible
FROM yj_field WHERE panel_code='RD_INSP_PLAN' ORDER BY place, seq;
GO
SELECT N'S1-49: yj_doc_modify_log 中 RD_ 记录' AS sec, panel_code, doc_no, apply_by, apply_at FROM yj_doc_modify_log WHERE panel_code LIKE 'RD%';
GO
SELECT N'S1-50: yj_doc_modify_log 总行数' AS sec, COUNT(*) AS n FROM yj_doc_modify_log;
GO
