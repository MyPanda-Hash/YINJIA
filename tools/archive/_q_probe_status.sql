SET NOCOUNT ON;
PRINT '── 探针单据在 yj_doc_status 的作废/审核标记 ──';
SELECT doc_no, panel_code, ISNULL(canceled,'(null)') AS canceled, ISNULL(shr,'(null)') AS 审核人 FROM yj_doc_status
WHERE doc_no IN ('SL-2026-09-0006','SL-2026-09-0007','SL-2026-09-0008','SL-2026-09-0009',
                 'IJ-2026-09-0005','IJ-2026-09-0006','IJ-2026-09-0007','IJ-2026-09-0008',
                 'PI-2026-09-0007','PI-2026-09-0008')
ORDER BY panel_code, doc_no;
GO
PRINT '── 业务可见性核对:探针单据是否还在列表口径(头表 asp_cancel=N 且未被 yj_doc_status 作废) ──';
SELECT 'sl_recv' AS t, COUNT(*) AS 可见 FROM sl_recv h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
  AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='SL_RECV' AND s.doc_no=h.单据编号 AND s.canceled='Y')
UNION ALL SELECT 'qc_insp', COUNT(*) FROM qc_insp h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
  AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_INSP' AND s.doc_no=h.单据编号 AND s.canceled='Y')
UNION ALL SELECT 'bd_purchase_in', COUNT(*) FROM bd_purchase_in h WHERE ISNULL(h.asp_cancel,'N')<>'Y'
  AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号 AND s.canceled='Y');
GO
PRINT '── 探针链路占用是否已释放 ──';
SELECT COUNT(*) AS 探针活跃占用 FROM form_flow_link WHERE link_status='ACTIVE'
  AND (source_form_no LIKE 'SL-2026-09-000%' OR source_form_no LIKE 'IJ-2026-09-000%' OR target_form_no LIKE 'PI-2026-09-%');
GO
