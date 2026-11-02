SET NOCOUNT ON;
DELETE FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-OPNAME';
DELETE FROM dbo.yj_doc_status WHERE doc_no=N'BG-TEST-OPNAME';
DELETE FROM dbo.yj_form_approval WHERE form_no=N'BG-TEST-OPNAME';
INSERT INTO dbo.scjl (comm, sc_no, [报工单号], sc_date, gldh, [工单行号], [批次号], gxdm, sl, gd_id, wgzt, asp_user1, asp_time1, asp_cancel)
VALUES (N'BG-TEST-OPNAME', N'MO-2026-09-0108', N'BG-TEST-OPNAME', '2026-11-01', N'MO-2026-09-0108', 1, N'20260928', N'OP-CX', 1, 0, NULL, N'admin', GETDATE(), 'N');
INSERT INTO dbo.yj_doc_status (panel_code, doc_no, pending, canceled, saved, update_at)
VALUES ('WO_REPORT', N'BG-TEST-OPNAME', 'N', 'N', 'Y', GETDATE());
SELECT id,[报工单号],gldh,[工单行号],[批次号],gxdm,sl,gd_id FROM dbo.scjl WHERE [报工单号]=N'BG-TEST-OPNAME';
