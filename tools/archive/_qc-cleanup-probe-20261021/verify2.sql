SET NOCOUNT ON;
SELECT '=== statuses ===' AS x;
SELECT panel_code,COUNT(*) n,SUM(CASE WHEN shr=N'冯敏' THEN 1 ELSE 0 END) fengmin FROM yj_doc_status WHERE panel_code IN ('QC_INSP','QC_CATALOG','QC_INSP_REC','QC_RETURN') GROUP BY panel_code;
GO
SELECT '=== returns with insp ===' AS x;
SELECT r.单据编号,r.单据日期,r.检验单号,r.供应商代码,r.供应商,r.数量,r.单据状态,d.物料编码,d.退货数量,d.送检数量,d.不良原因
FROM qc_return r JOIN qc_return_detail d ON d.单据编号=r.单据编号 ORDER BY r.单据编号,d.id;
GO
SELECT '=== insp supplier code ===' AS x;
SELECT 单据编号,供应商代码,供应商,暂收单号,审核时间,检验日期 FROM qc_insp ORDER BY 单据编号;
GO
SELECT '=== date consistency ===' AS x;
SELECT COUNT(*) insp_bad FROM qc_insp i WHERE i.单据日期<>i.检验日期 OR LEFT(i.审核时间,10)<>i.单据日期;
SELECT COUNT(*) detail_bad FROM qc_insp_detail d JOIN qc_insp i ON i.单据编号=d.单据编号 WHERE d.日期<>i.单据日期;
SELECT COUNT(*) rec_bad FROM qc_insp_rec r WHERE r.单据日期<>r.检验日期 OR r.单据日期<>r.来料日期;
SELECT COUNT(*) ret_bad FROM qc_return r JOIN qc_return_detail d ON d.单据编号=r.单据编号 WHERE d.日期<>r.单据日期;
GO
SELECT '=== source links sample ===' AS x;
SELECT TOP 20 source_form_no,source_line_key,target_form_no,target_line_key,source_quantity,linked_quantity,batch_no,batch_id,link_status FROM form_flow_link WHERE source_panel_code='QC_RECV' AND target_panel_code='QC_INSP' ORDER BY id;
GO
SELECT '=== return links sample ===' AS x;
SELECT TOP 20 source_form_no,source_line_key,target_form_no,target_line_key,source_quantity,linked_quantity,batch_no,batch_id,link_status FROM form_flow_link WHERE source_panel_code='QC_INSP' AND target_panel_code='QC_RETURN' ORDER BY id;
GO
