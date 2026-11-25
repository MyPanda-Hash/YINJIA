SET NOCOUNT ON;
PRINT '--- v1: 孤儿占用数(应为 0) ---';
SELECT COUNT(*) AS 孤儿占用数 FROM (
  SELECT l.source_form_no, l.target_form_no
  FROM form_flow_link l
  WHERE l.link_status='ACTIVE' AND l.source_panel_code='PU_ORDER' AND l.target_panel_code='QC_RECV'
    AND LTRIM(RTRIM(ISNULL(l.target_form_no,N'')))<>N''
    AND NOT EXISTS (SELECT 1 FROM yj_doc_batch b
                    WHERE b.source_panel_code=l.source_panel_code AND b.source_form_no=l.source_form_no
                      AND b.target_form_no=l.target_form_no AND b.status IN ('ACTIVE','PENDING'))
  GROUP BY l.source_form_no, l.target_form_no) t;

PRINT '--- v2: 本次回填/恢复的台账行 ---';
SELECT id, source_form_no AS 采购订单, batch_no AS 批次号, batch_qty AS 数量, status, target_form_no AS 去向单, remark
FROM yj_doc_batch WHERE remark LIKE N'孤儿占用回填%' ORDER BY id;

PRINT '--- v3: 订单 YJ-20260921-10 的台账行(有效态) ---';
SELECT id, batch_no, batch_qty, status, target_panel_code, target_form_no,
       CONVERT(varchar(19), create_time, 120) AS create_time
FROM yj_doc_batch
WHERE source_panel_code='PU_ORDER' AND source_form_no=N'YJ-20260921-10'
  AND status IN ('ACTIVE','PENDING') ORDER BY batch_seq, id;

PRINT '--- v4: 该单三处号对照 ---';
SELECT l.target_form_no AS 暂收单, MAX(s.批次号) AS 单据批次号, MAX(l.batch_no) AS 占用批次号,
       (SELECT MAX(b.batch_no) FROM yj_doc_batch b WHERE b.target_form_no=l.target_form_no AND b.source_form_no=l.source_form_no) AS 台账批次号,
       SUM(COALESCE(l.linked_quantity,0)) AS 占用数量
FROM form_flow_link l JOIN sl_recv s ON s.单据编号=l.target_form_no
WHERE l.link_status='ACTIVE' AND l.source_panel_code='PU_ORDER' AND l.target_panel_code='QC_RECV'
  AND l.source_form_no=N'YJ-20260921-10'
GROUP BY l.source_form_no, l.target_form_no;
