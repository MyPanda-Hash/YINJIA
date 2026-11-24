SET NOCOUNT ON;
SELECT s.panel_code, s.doc_no, s.shr, s.shsj, s.pending, s.canceled, s.saved
  FROM dbo.yj_doc_status s
 WHERE s.doc_no IN (N'ZJ-2026-11-0009', N'ZJ-2026-11-0007', N'ZJ-2026-11-0011', N'ZJ-2026-11-0023')
 ORDER BY s.doc_no;
