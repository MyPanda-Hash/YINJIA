SET NOCOUNT ON;
GO
SELECT N'S1-39: yj_form_approval 列' AS sec, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME='yj_form_approval' ORDER BY ORDINAL_POSITION;
GO
SELECT N'S1-40: yj_form_approval 中 RD_ 面板记录' AS sec, * FROM yj_form_approval WHERE panel_code LIKE 'RD%';
GO
SELECT N'S1-41: yj_form_approval 总行数' AS sec, COUNT(*) AS n FROM yj_form_approval;
GO
SELECT N'S1-42: yj_doc_modify_log 列(修改记录/履历近亲)' AS sec, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME='yj_doc_modify_log' ORDER BY ORDINAL_POSITION;
GO
SELECT N'S1-43: rd_dev_task 列 + 行数' AS sec, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME='rd_dev_task' ORDER BY ORDINAL_POSITION;
GO
SELECT N'S1-44: 四个受控文件的 yj_field 全字段(核对表头是否有文件编码)' AS sec,
       panel_code, seq, col_name, label, data_type, place, editable, required, hidden, visible
FROM yj_field WHERE panel_code IN ('RD_SPEC_DOC','RD_ASM_PROC','RD_INSP_PLAN','RD_ASM_BOM')
ORDER BY panel_code, place, seq;
GO
