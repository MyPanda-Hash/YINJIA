SELECT id, seq, label, col_name, data_type, place, visible, hidden, editable, required, width
FROM yj_field WHERE panel_code = N'QC_INSP' AND place LIKE N'%detail%' ORDER BY seq, id;
GO
SELECT scope, ref_key, locale, text FROM yj_translation WHERE scope = N'field' AND ref_key IN (N'特采', N'不合格品数量', N'不合格品处理单号') ORDER BY ref_key, locale;
GO
SELECT COL_LENGTH('dbo.qc_insp_detail', N'特采') AS insp_tc, COL_LENGTH('dbo.qc_insp_rec', N'不合格品处理单号') AS rec_ng, COL_LENGTH('dbo.qc_return_detail', N'特采') AS ret_tc;
GO
SELECT COUNT(*) AS tc_docs FROM qc_tc_in WHERE ISNULL(asp_cancel,'N') <> 'Y';
SELECT COUNT(*) AS tc_active_links FROM form_flow_link WHERE target_panel_code='QC_TC_IN' AND link_status='ACTIVE';
