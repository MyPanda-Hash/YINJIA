-- q-02-forms.sql — 表单号格式/QC_INSP 查询位字段/migrate-table-comments 中 rd_progress 注明样例
SET NOCOUNT ON;
SELECT 'A.QC_INSP字段位' AS k, col_name, place, data_type, seq FROM yj_field WHERE panel_code = N'QC_INSP' AND place LIKE N'%query%' ORDER BY seq;
SELECT 'B.头表现值' AS k, 单据编号, 单据日期 FROM rd_progress;
SELECT 'C.单据状态行' AS k, panel_code, doc_no, canceled, saved FROM yj_doc_status WHERE panel_code = N'RD_PROGRESS';
