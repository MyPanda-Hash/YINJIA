SET NOCOUNT ON;
PRINT '===== 1. YJ-20260915-11 的台账行 =====';
SELECT id AS batchId, batch_no, status, source_panel_code, source_form_no,
       target_panel_code, target_form_no, CONVERT(varchar(19),create_time,120) AS create_time
FROM yj_doc_batch WHERE source_form_no = N'YJ-20260915-11' ORDER BY batch_seq, id;

PRINT '===== 2. 这些批次的链路 =====';
SELECT l.id, l.batch_id, l.source_panel_code, l.source_form_no, l.target_panel_code,
       l.target_form_no, l.link_status, l.create_by
FROM form_flow_link l JOIN yj_doc_batch b ON b.id = l.batch_id
WHERE b.source_form_no = N'YJ-20260915-11' ORDER BY l.batch_id, l.id;

PRINT '===== 3. 链路里出现的所有单据的 yj_doc_status =====';
SELECT l.batch_id, l.target_panel_code AS panel, l.target_form_no AS doc_no,
       ISNULL(s.canceled,'N') AS canceled, ISNULL(s.deleting,'N') AS deleting,
       s.shr, s.cancel_by, CONVERT(varchar(19),s.cancel_at,120) AS cancel_at
FROM form_flow_link l JOIN yj_doc_batch b ON b.id = l.batch_id
LEFT JOIN yj_doc_status s ON s.panel_code = l.target_panel_code AND s.doc_no = l.target_form_no
WHERE b.source_form_no = N'YJ-20260915-11' ORDER BY l.batch_id, l.id;

PRINT '===== 4. QC_RETURN 单据作废盘点(全库) =====';
SELECT COUNT(*) AS 退料单总数,
       SUM(CASE WHEN ISNULL(s.canceled,'N')='Y' THEN 1 ELSE 0 END) AS yj作废数,
       SUM(CASE WHEN ISNULL(r.asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 表内作废数,
       SUM(CASE WHEN s.doc_no IS NULL THEN 1 ELSE 0 END) AS 无状态行数
FROM qc_return r LEFT JOIN yj_doc_status s ON s.panel_code='QC_RETURN' AND s.doc_no=r.单据编号;

PRINT '===== 5. QC_RETURN 逐张(编号/表内作废/状态表) =====';
SELECT r.单据编号, ISNULL(r.asp_cancel,'N') AS asp_cancel, r.检验单号, r.采购订单号, r.批次号,
       ISNULL(s.canceled,'N') AS canceled, ISNULL(s.deleting,'N') AS deleting, s.shr,
       s.cancel_by, CONVERT(varchar(19),s.cancel_at,120) AS cancel_at
FROM qc_return r LEFT JOIN yj_doc_status s ON s.panel_code='QC_RETURN' AND s.doc_no=r.单据编号
ORDER BY r.单据编号;

PRINT '===== 6. 指向 QC_RETURN 的链路(状态分布) =====';
SELECT l.link_status, COUNT(*) AS 条数 FROM form_flow_link l
WHERE l.target_panel_code='QC_RETURN' GROUP BY l.link_status;

PRINT '===== 7. 指向 QC_RETURN 的 ACTIVE 链路(逐条,带退料单作废态) =====';
SELECT l.id, l.source_panel_code, l.source_form_no, l.target_form_no, l.batch_id,
       ISNULL(s.canceled,'N') AS ret_canceled, ISNULL(r.asp_cancel,'N') AS ret_asp_cancel, s.shr
FROM form_flow_link l
LEFT JOIN yj_doc_status s ON s.panel_code='QC_RETURN' AND s.doc_no=l.target_form_no
LEFT JOIN qc_return r ON r.单据编号 = l.target_form_no
WHERE l.target_panel_code='QC_RETURN' AND l.link_status='ACTIVE'
ORDER BY l.id;
