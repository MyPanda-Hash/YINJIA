SET NOCOUNT ON;
SELECT id, source_panel_code, source_form_no, source_line_key, target_panel_code, target_form_no, link_status
  FROM dbo.form_flow_link WHERE target_form_no IN (N'LL-2026-11-0010', N'LL-2026-11-0011');
SELECT ID, dh, lb FROM dbo.s_allno WHERE dh LIKE N'LL-2026-11-001%';
SELECT panel_code, doc_no FROM dbo.yj_doc_status WHERE doc_no IN (N'LL-2026-11-0010', N'LL-2026-11-0011');
