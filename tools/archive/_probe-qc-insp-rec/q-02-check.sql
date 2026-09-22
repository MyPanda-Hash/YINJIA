-- q-02-check.sql — 检验数据记录落库核对:头表全行 + 行表 + 状态行
SET NOCOUNT ON;
SELECT 'A.头表' AS k, 单据编号, 物料批次, 文件编码, 检验依据, 检验人, 审核人, 检验日期, 单据日期 FROM qc_insp_rec;
SELECT 'B.行表' AS k, 单据编号, 检验项, 检测标准, 检测结果, 单项判定 FROM qc_insp_rec_detail;
SELECT 'C.状态行' AS k, doc_no, saved, canceled FROM yj_doc_status WHERE panel_code = 'QC_INSP_REC';
