SET NOCOUNT ON;
SELECT h.单据编号, dt.物料编码, dt.物料名称, dt.批次号, dt.送检数量, dt.单位, dt.计量单位,
       (SELECT COUNT(*) FROM qc_catalog_detail d WHERE d.检验单号=h.单据编号 AND d.物料编码=dt.物料编码 AND ISNULL(d.asp_cancel,'N')<>'Y') cat,
       (SELECT COUNT(*) FROM qc_insp_rec r WHERE r.来料检验单号=h.单据编号 AND r.物料编码=dt.物料编码 AND ISNULL(r.asp_cancel,'N')<>'Y') rec
FROM qc_insp h JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND ISNULL(dt.asp_cancel,'N')<>'Y'
ORDER BY h.单据编号, dt.物料编码;
GO
SELECT COUNT(*) alive_detail_lines FROM qc_insp h JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND ISNULL(dt.asp_cancel,'N')<>'Y';
SELECT s.doc_no, s.canceled, s.saved FROM yj_doc_status s WHERE s.panel_code='QC_INSP_REC' ORDER BY s.doc_no;
SELECT dh, lb, ny FROM s_allno WHERE dh='JYSJ-2026-10-0089';
