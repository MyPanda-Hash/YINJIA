SET NOCOUNT ON;
DELETE FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-ANCHOR';
DELETE FROM dbo.yj_doc_status WHERE panel_code=N'WO_REPORT' AND doc_no=N'BG-TEST-ANCHOR';
INSERT INTO dbo.scjl (comm, sc_no, [报工单号], sc_date, gldh, [工单行号], gxdm, sl, gd_id, wgzt, asp_user1, asp_time1, asp_cancel)
VALUES (N'BG-TEST-ANCHOR', N'GD-2026-10-0012', N'BG-TEST-ANCHOR', '2026-11-01', N'GD-2026-10-0012', 0, N'成型', 1, 0, NULL, N'admin', GETDATE(), 'N');
INSERT INTO dbo.yj_doc_status (panel_code, doc_no, pending, canceled, saved, update_at)
VALUES ('WO_REPORT', N'BG-TEST-ANCHOR', 'N', 'N', 'Y', GETDATE());
SELECT id, [报工单号], gldh, [工单行号], gxdm, sl, gd_id FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-ANCHOR';
SELECT panel_code, doc_no, pending, canceled, saved FROM dbo.yj_doc_status WHERE doc_no=N'BG-TEST-ANCHOR';
