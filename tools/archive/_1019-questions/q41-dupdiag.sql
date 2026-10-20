SELECT id, 单据编号, 单据日期, ISNULL(供应商,N'(空)') AS 供应商, ISNULL(采购订单号,N'(空)') AS 采购订单号,
       ISNULL(批次号,N'(空)') AS 批次号, ISNULL(备注,N'(空)') AS 备注, asp_user1,
       CONVERT(nvarchar(19), asp_time1, 120) AS 创建时间, asp_cancel
FROM qc_insp WHERE 单据编号 IN ('IJ-2026-10-0022','IJ-2026-10-0027') ORDER BY 单据编号, id
GO
SELECT 单据编号, id, ISNULL(物料编码,N'(空)') AS 物料编码, ISNULL(送检数量,0) AS 送检数量
FROM qc_insp_detail WHERE 单据编号 IN ('IJ-2026-10-0022','IJ-2026-10-0027') ORDER BY 单据编号, id
GO
SELECT panel_code, doc_no, saved, canceled FROM yj_doc_status WHERE panel_code='QC_INSP' AND doc_no IN ('IJ-2026-10-0022','IJ-2026-10-0027')
GO
SELECT panel_code, doc_no FROM form_flow_link WHERE source_form_no IN ('IJ-2026-10-0022','IJ-2026-10-0027') OR target_form_no IN ('IJ-2026-10-0022','IJ-2026-10-0027')
GO
SELECT 单据编号 FROM qc_catalog_detail WHERE 检验单号 IN ('IJ-2026-10-0022','IJ-2026-10-0027')
