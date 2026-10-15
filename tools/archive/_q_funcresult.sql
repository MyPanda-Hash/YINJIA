SET NOCOUNT ON;
PRINT '== A. qc_proc_insp_detail 是否已有 产线常规功能性结果 ==';
SELECT COL_LENGTH(N'dbo.qc_proc_insp_detail', N'产线常规功能性结果') AS col_bytes;

PRINT '== B. yj_field 里 产线常规功能性结果 的登记(哪些面板有) ==';
SELECT panel_code, label, col_name, data_type, place, seq, visible, hidden
FROM dbo.yj_field WHERE label = N'产线常规功能性结果' ORDER BY panel_code;

PRINT '== C. 该标签的译名现状 ==';
SELECT scope, ref_key, locale, text, source FROM dbo.yj_translation
WHERE scope = N'field' AND ref_key = N'产线常规功能性结果' ORDER BY locale;

PRINT '== D. QC_PROC_INSP 明细字段现役(place=detail,visible=1) ==';
SELECT seq, label, col_name, data_type, hidden FROM dbo.yj_field
WHERE panel_code = N'QC_PROC_INSP' AND place LIKE N'%detail%' AND visible = 1 AND ISNULL(hidden,0) = 0
ORDER BY seq, id;

PRINT '== E. QC_PROC_INSP 表头字段(纸张抬头用) ==';
SELECT seq, label, col_name, place, hidden FROM dbo.yj_field
WHERE panel_code = N'QC_PROC_INSP' AND place LIKE N'%header%' AND ISNULL(hidden,0) = 0 ORDER BY seq, id;
