SET NOCOUNT ON;
DELETE FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-DATE';
DELETE FROM dbo.yj_doc_status WHERE doc_no=N'BG-TEST-DATE';
DELETE FROM dbo.yj_form_approval WHERE form_no=N'BG-TEST-DATE';
INSERT INTO dbo.scjl (comm, sc_no, [报工单号], sc_date, gldh, [工单行号], [批次号], gxdm, sl, gd_id, wgzt, asp_user1, asp_time1, asp_cancel)
VALUES (N'BG-TEST-DATE', N'MO-2026-09-0108', N'BG-TEST-DATE', NULL, N'MO-2026-09-0108', 1, N'20260928', N'成型', 1, 0, NULL, N'admin', GETDATE(), 'N');
INSERT INTO dbo.yj_doc_status (panel_code, doc_no, pending, canceled, saved, update_at)
VALUES ('WO_REPORT', N'BG-TEST-DATE', 'N', 'N', 'Y', GETDATE());
SELECT id,[报工单号],sc_date,gldh,[工单行号],gxdm,sl FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-DATE';
