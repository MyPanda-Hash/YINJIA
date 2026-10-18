SET NOCOUNT ON;
SELECT panel_code, doc_no, shr, shsj, canceled, pending, stopped, saved, archived FROM dbo.yj_doc_status WHERE doc_no IN (N'SJ-2026-10-0062',N'ZC-2026-10-0030',N'SJ-2026-10-0061');
GO
