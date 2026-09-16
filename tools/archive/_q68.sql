SET NOCOUNT ON;
UPDATE s SET s.shr = ISNULL(h.审核人, N'金蝶同步'), s.shsj = ISNULL(CONVERT(varchar(19), h.审核时间, 120), CONVERT(varchar(19), h.asp_time1, 120)), s.saved = 'Y'
FROM yj_doc_status s JOIN bd_purchase_in h ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
WHERE h.单据状态 = N'已审核';
INSERT INTO yj_doc_status (panel_code, doc_no, shr, shsj, saved)
SELECT DISTINCT 'PURCHASE_IN', h.单据编号, ISNULL(h.审核人, N'金蝶同步'), ISNULL(CONVERT(varchar(19), h.审核时间, 120), CONVERT(varchar(19), h.asp_time1, 120)), 'Y'
FROM bd_purchase_in h
WHERE h.单据状态 = N'已审核'
  AND NOT EXISTS(SELECT 1 FROM yj_doc_status s WHERE s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号);
UPDATE s SET s.shr = ISNULL(h.审核人, N'金蝶同步'), s.shsj = ISNULL(CONVERT(varchar(19), h.审核时间, 120), CONVERT(varchar(19), h.asp_time1, 120)), s.saved = 'Y'
FROM yj_doc_status s JOIN bd_sale_out h ON s.panel_code='SALE_OUT' AND s.doc_no=h.单据编号
WHERE h.单据状态 = N'已审核';
INSERT INTO yj_doc_status (panel_code, doc_no, shr, shsj, saved)
SELECT DISTINCT 'SALE_OUT', h.单据编号, ISNULL(h.审核人, N'金蝶同步'), ISNULL(CONVERT(varchar(19), h.审核时间, 120), CONVERT(varchar(19), h.asp_time1, 120)), 'Y'
FROM bd_sale_out h
WHERE h.单据状态 = N'已审核'
  AND NOT EXISTS(SELECT 1 FROM yj_doc_status s WHERE s.panel_code='SALE_OUT' AND s.doc_no=h.单据编号);
SELECT panel_code, doc_no, shr FROM yj_doc_status WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') ORDER BY panel_code, doc_no;
