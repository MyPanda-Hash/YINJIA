SET NOCOUNT ON;
PRINT '===== A. 全部台账行 + 起点单据有效性 =====';
SELECT b.id AS batchId, b.batch_no, b.status, b.source_panel_code, b.source_form_no,
       b.target_panel_code AS startPanel, b.target_form_no AS startNo,
       ISNULL(s.canceled,'N') AS start_canceled, ISNULL(s.deleting,'N') AS start_deleting,
       CASE WHEN s.shr IS NULL AND ISNULL(s.canceled,'N')<>'Y' THEN N'草稿/未审' ELSE N'其他' END AS start_state
FROM yj_doc_batch b
LEFT JOIN yj_doc_status s ON s.panel_code=b.target_panel_code AND s.doc_no=b.target_form_no
WHERE b.status IN ('ACTIVE','PENDING')
ORDER BY b.source_form_no, b.batch_seq, b.id;

PRINT '===== B. 台账行 = 退料单(QC_RETURN)的批次 =====';
SELECT id, batch_no, status, source_form_no, target_panel_code, target_form_no
FROM yj_doc_batch WHERE target_panel_code='QC_RETURN';

PRINT '===== C. 所有 ACTIVE 链路 + 目标单据作废态(全库) =====';
SELECT l.id AS linkId, l.batch_id, l.source_panel_code AS sp, l.source_form_no AS sn,
       l.target_panel_code AS tp, l.target_form_no AS tn,
       ISNULL(s.canceled,'N') AS t_canceled, ISNULL(s.deleting,'N') AS t_deleting,
       CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END AS t_state,
       CASE WHEN l.batch_id IS NULL THEN N'无批次' ELSE N'有批次' END AS 批次
FROM form_flow_link l
LEFT JOIN yj_doc_status s ON s.panel_code=l.target_panel_code AND s.doc_no=l.target_form_no
WHERE l.link_status='ACTIVE'
  AND l.source_panel_code IN ('PU_ORDER','QC_RECV','QC_INSP')
ORDER BY l.source_panel_code, l.source_form_no, l.id;

PRINT '===== D. QC_RETURN 面板的列表口径过滤(是否过滤作废) —— 面板行数 =====';
SELECT COUNT(*) AS qc_return行数 FROM qc_return;

PRINT '===== E. 各来源单据 → 退料单链路(含 RELEASED),看退料单是否作废 =====';
SELECT l.id, l.link_status, l.source_form_no AS 检验单, l.target_form_no AS 退料单,
       ISNULL(s.canceled,'N') AS 退料单作废, r.采购订单号, r.批次号
FROM form_flow_link l
LEFT JOIN yj_doc_status s ON s.panel_code='QC_RETURN' AND s.doc_no=l.target_form_no
LEFT JOIN qc_return r ON r.单据编号=l.target_form_no
WHERE l.target_panel_code='QC_RETURN' ORDER BY l.id;
