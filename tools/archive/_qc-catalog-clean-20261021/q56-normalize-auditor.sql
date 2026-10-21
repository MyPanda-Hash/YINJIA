SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRAN;
UPDATE s
SET shr = N'冯敏', approve_node = NULL, pending_by = NULL, pending_at = NULL,
    saved = N'Y', archived = N'N', update_at = GETDATE()
FROM yj_doc_status s
WHERE s.panel_code = N'QC_INSP'
  AND s.doc_no IN (N'IJ-2026-09-0152', N'IJ-2026-10-0001', N'IJ-2026-10-0200');
PRINT N'status rows: ' + CAST(@@ROWCOUNT AS nvarchar(10));
UPDATE h
SET 审核人 = N'冯敏',
    审核时间 = FORMAT(GETDATE(), N'yyyy-MM-dd HH:mm:ss'),
    asp_user2 = N'qc-approve-20261021', asp_time2 = GETDATE()
FROM qc_insp h
WHERE h.单据编号 IN (N'IJ-2026-09-0152', N'IJ-2026-10-0001', N'IJ-2026-10-0200');
PRINT N'head rows: ' + CAST(@@ROWCOUNT AS nvarchar(10));
COMMIT;
SELECT h.单据编号, h.审核人, h.审核时间, s.shr, s.pending, s.approve_node, s.saved, s.archived
FROM qc_insp h LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=h.单据编号
WHERE h.单据编号 IN (N'IJ-2026-09-0152',N'IJ-2026-10-0001',N'IJ-2026-10-0200') ORDER BY h.单据编号;
