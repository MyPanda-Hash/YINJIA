SET NOCOUNT ON;
SELECT 'cat' k, COUNT(*) n FROM qc_catalog_detail WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'rec',COUNT(*) FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'rec_detail',COUNT(*) FROM qc_insp_rec_detail
UNION ALL SELECT 'status',COUNT(*) FROM yj_doc_status WHERE panel_code='QC_INSP_REC'
UNION ALL SELECT 'approval',COUNT(*) FROM yj_form_approval WHERE panel_code='QC_INSP_REC'
UNION ALL SELECT 'tci_ref',COUNT(*) FROM qc_tc_in WHERE ISNULL(检验数据记录单号,'')<>'';
GO
SELECT id,检验单号,检验数据记录单号,物料编码,物料名称,批次号,数量,计量单位,检验状态 FROM qc_catalog_detail WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 检验单号,物料编码;
GO
SELECT id,单据编号,单据日期,物料编码,物料名称,物料批次,来料数量,计量单位,来料检验单号 FROM qc_insp_rec WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据编号;
GO
SELECT 'bak_cat' k,COUNT(*) n FROM _bak_qccat_detail_20261021
UNION ALL SELECT 'bak_rec',COUNT(*) FROM _bak_qcrec_20261021
UNION ALL SELECT 'bak_rec_detail',COUNT(*) FROM _bak_qcrec_detail_20261021
UNION ALL SELECT 'bak_status',COUNT(*) FROM _bak_qcrec_status_20261021
UNION ALL SELECT 'bak_approval',COUNT(*) FROM _bak_qcrec_approval_20261021;
