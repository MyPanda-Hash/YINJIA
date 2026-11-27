SELECT panel_code, panel_name, panel_name_en, category, module_group FROM yj_panel WHERE panel_code IN (N'QC_TC_IN', N'QC_INSP');
GO
SELECT panel_code, id, seq, label, col_name, data_type, place, visible, hidden, editable FROM yj_field
WHERE (panel_code = N'QC_INSP' AND col_name = N'特采') OR (panel_code = N'QC_RETURN' AND col_name = N'特采')
   OR (panel_code = N'QC_INSP_REC' AND col_name = N'不合格品处理单号');
GO
SELECT scope, ref_key, locale, text FROM yj_translation WHERE scope='panel' AND ref_key LIKE N'%不合格品处理单%';
GO
SELECT scope, ref_key, locale, text FROM yj_translation WHERE scope='panel' AND ref_key=N'特采单';
GO
SELECT COL_LENGTH('dbo.qc_insp_rec', N'不合格品处理单号') AS rec_ng;
