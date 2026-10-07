SET NOCOUNT ON;
SELECT N'1-FIELDS' AS seg, col_name, label, data_type, place, CAST(seq AS varchar(10)) AS seq,
       CAST(editable AS varchar(5)) AS editable, CAST(hidden AS varchar(5)) AS hidden, CAST(visible AS varchar(5)) AS visible
FROM yj_field WHERE panel_code = 'QC_TC_IN' AND col_name IN (N'编制人', N'审核人', N'审核时间', N'审批人', N'审批时间')
ORDER BY seq;
SELECT N'2-TRANSLATIONS' AS seg, ref_key, locale, text
FROM yj_translation WHERE scope = 'field' AND ref_key IN (N'编制人', N'审核人', N'审批人', N'审批时间')
ORDER BY ref_key, locale;
SELECT N'3-COLCOMMENTS' AS seg, c.name AS col, CAST(ep.value AS nvarchar(200)) AS descr
FROM sys.columns c
JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE c.object_id = OBJECT_ID('qc_tc_in')
  AND c.name IN (N'编制人', N'审核人', N'审核时间', N'审批人', N'审批时间')
ORDER BY c.column_id;
