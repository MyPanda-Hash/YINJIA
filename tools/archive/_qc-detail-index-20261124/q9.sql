SET NOCOUNT ON;
-- 明细表里引用的检验单号,哪些在 qc_insp 里已作废(asp_cancel=Y 或 doc_status.canceled=Y)或不存在
SELECT d.来料检验单号 AS 检验单号,
       SUM(CASE WHEN h.单据编号 IS NULL THEN 1 ELSE 0 END) AS 不存在行数,
       SUM(CASE WHEN h.单据编号 IS NOT NULL AND ISNULL(h.asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 软删行数,
       COUNT(*) AS 引用行数
FROM v_qc_insp_rec_detail d
LEFT JOIN qc_insp h ON h.单据编号 = d.来料检验单号
GROUP BY d.来料检验单号
HAVING SUM(CASE WHEN h.单据编号 IS NULL THEN 1 ELSE 0 END) > 0
    OR SUM(CASE WHEN h.单据编号 IS NOT NULL AND ISNULL(h.asp_cancel,'N')='Y' THEN 1 ELSE 0 END) > 0
ORDER BY 来料检验单号;
-- 作废登记(qc_insp 面板)
SELECT TOP 10 doc_no, canceled, saved FROM yj_doc_status WHERE panel_code='QC_INSP' AND ISNULL(canceled,'N')='Y' ORDER BY update_at DESC;
