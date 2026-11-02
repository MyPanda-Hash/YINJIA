SET NOCOUNT ON;
UPDATE s
SET s.pending = N'N', s.pending_by = NULL, s.pending_at = NULL, s.update_at = GETDATE()
FROM dbo.yj_doc_status s
JOIN dbo.qc_insp_rec r ON r.单据编号 = s.doc_no AND ISNULL(r.asp_cancel, N'N') <> N'Y'
WHERE s.panel_code = N'QC_INSP_REC'
  AND ISNULL(s.pending, N'N') = N'Y'
  AND r.asp_time1 IS NOT NULL
  AND s.pending_at < r.asp_time1
  AND NOT EXISTS (SELECT 1 FROM dbo.yj_form_approval a
                  WHERE a.panel_code = N'QC_INSP_REC' AND a.form_no = s.doc_no);
SELECT @@ROWCOUNT fixed_pending;
SELECT doc_no, pending, pending_by, pending_at, shr, saved FROM yj_doc_status WHERE panel_code='QC_INSP_REC' ORDER BY doc_no;
