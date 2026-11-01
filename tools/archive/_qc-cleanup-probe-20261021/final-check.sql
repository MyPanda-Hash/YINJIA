SET NOCOUNT ON;
SELECT 'QC_INSP' k, COUNT(*) n, SUM(数量) qty FROM qc_insp
UNION ALL SELECT 'QC_INSP_DETAIL', COUNT(*), SUM(送检数量) FROM qc_insp_detail
UNION ALL SELECT 'QC_CATALOG', COUNT(*), NULL FROM qc_catalog
UNION ALL SELECT 'QC_CATALOG_DETAIL', COUNT(*), NULL FROM qc_catalog_detail
UNION ALL SELECT 'QC_INSP_REC', COUNT(*), NULL FROM qc_insp_rec
UNION ALL SELECT 'QC_INSP_REC_DETAIL', COUNT(*), NULL FROM qc_insp_rec_detail
UNION ALL SELECT 'QC_RETURN', COUNT(*), SUM(数量) FROM qc_return
UNION ALL SELECT 'QC_RETURN_DETAIL', COUNT(*), SUM(退货数量) FROM qc_return_detail;
GO
SELECT 'status' k, panel_code, COUNT(*) n,
       SUM(CASE WHEN shr=N'冯敏' THEN 1 ELSE 0 END) audited_fengmin
FROM yj_doc_status WHERE panel_code IN ('QC_INSP','QC_CATALOG','QC_INSP_REC','QC_RETURN')
GROUP BY panel_code;
GO
SELECT 'bad_dates' k, COUNT(*) n FROM qc_insp i
WHERE i.单据日期<>i.检验日期 OR LEFT(i.审核时间,10)<>i.单据日期
   OR EXISTS (SELECT 1 FROM qc_insp_detail d WHERE d.单据编号=i.单据编号 AND d.日期<>i.单据日期)
   OR EXISTS (SELECT 1 FROM qc_return r WHERE r.检验单号=i.单据编号 AND r.单据日期<>i.单据日期);
GO
SELECT 'new_pi_links' k, COUNT(*) n FROM form_flow_link
WHERE source_panel_code='QC_INSP' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE';
GO
SELECT 'source_links' k, COUNT(*) n FROM form_flow_link
WHERE source_panel_code='QC_RECV' AND target_panel_code='QC_INSP' AND link_status='ACTIVE';
GO
