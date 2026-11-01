SET NOCOUNT ON;
-- current alive inspection docs + detail + catalog/rec coverage
SELECT h.单据编号 insp, ISNULL(h.asp_cancel,'N') hcancel, h.单据状态, h.批次号,
       dt.物料编码, ISNULL(dt.asp_cancel,'N') dcancel,
       (SELECT COUNT(*) FROM qc_catalog_detail d WHERE d.检验单号=h.单据编号 AND d.物料编码=dt.物料编码 AND ISNULL(d.asp_cancel,'N')<>'Y') cat,
       (SELECT COUNT(*) FROM qc_insp_rec r WHERE r.来料检验单号=h.单据编号 AND r.物料编码=dt.物料编码 AND ISNULL(r.asp_cancel,'N')<>'Y') rec
FROM qc_insp h LEFT JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
ORDER BY h.单据编号, dt.id;
GO
-- status rows
SELECT panel_code, COUNT(*) n, SUM(CASE WHEN canceled='Y' THEN 1 ELSE 0 END) canceled, SUM(CASE WHEN saved='Y' THEN 1 ELSE 0 END) saved
FROM yj_doc_status WHERE panel_code IN ('QC_CATALOG','QC_INSP_REC','QC_INSP') GROUP BY panel_code;
GO
-- approvals
SELECT panel_code, COUNT(*) n FROM yj_form_approval WHERE panel_code IN ('QC_CATALOG','QC_INSP_REC') GROUP BY panel_code;
GO
-- rec detail orphans
SELECT COUNT(*) rec_detail_orphan FROM qc_insp_rec_detail x
WHERE ISNULL(x.asp_cancel,'N')<>'Y' AND NOT EXISTS(SELECT 1 FROM qc_insp_rec r WHERE r.单据编号=x.单据编号 AND ISNULL(r.asp_cancel,'N')<>'Y');
-- qc_tc_in references
SELECT COUNT(*) tc_ref_rec FROM qc_tc_in WHERE ISNULL(检验数据记录单号,'')<>'';
SELECT TOP 10 单据编号, 检验数据记录单号 FROM qc_tc_in WHERE ISNULL(检验数据记录单号,'')<>'' ORDER BY 单据编号;
