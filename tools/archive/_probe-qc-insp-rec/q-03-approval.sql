SET NOCOUNT ON;
SELECT TOP 6 单据编号, 物料名称, 物料批次, 检验结论, 处理意见, 表单审核人, asp_user1 FROM qc_insp_rec ORDER BY id DESC;
SELECT TOP 6 panel_code, doc_no, saved, archived, shr FROM yj_doc_status WHERE panel_code = 'QC_INSP_REC' ORDER BY doc_no DESC;
GO
