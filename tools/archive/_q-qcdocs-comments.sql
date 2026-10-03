SET NOCOUNT ON;
SELECT N'1-COMMENTS' AS seg, OBJECT_NAME(c.object_id) AS tbl, c.name AS col,
       CAST(ep.value AS nvarchar(200)) AS descr
FROM sys.columns c
LEFT JOIN sys.extended_properties ep
       ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE c.object_id IN (OBJECT_ID('qc_bhg'), OBJECT_ID('qc_bhc'), OBJECT_ID('qc_bhz'),
                      OBJECT_ID('qc_jjf'), OBJECT_ID('qc_scp'), OBJECT_ID('qc_lyb'), OBJECT_ID('qc_scy'))
  AND c.name IN (N'填写人', N'责任人', N'检测人', N'编制人', N'审核人', N'审核时间', N'审批人', N'审批时间')
ORDER BY tbl, c.column_id;
SELECT N'2-SEQ' AS seg, panel_code, col_name, CAST(seq AS varchar(10)) AS seq, CAST(width AS varchar(10)) AS width
FROM yj_field WHERE panel_code IN ('QC_BHG','QC_BHC','QC_BHZ','QC_JJF','QC_SCP','QC_LYB','QC_SCY')
  AND col_name IN (N'审核人', N'审核时间') ORDER BY panel_code, seq;
SELECT N'3-TRANS' AS seg, ref_key, locale, text FROM yj_translation
WHERE scope = 'field' AND ref_key IN (N'填写人', N'责任人', N'检测人', N'审批人', N'审批时间')
ORDER BY ref_key, locale;
