SET NOCOUNT ON;
PRINT '== form_flow_link rows ==';
SELECT id, source_panel_code, source_form_no, source_line_key, target_panel_code, target_form_no, link_status
  FROM dbo.form_flow_link WHERE target_form_no IN (N'LL-2026-11-0010', N'LL-2026-11-0011');
PRINT '== s_allno 全部列 + LL 行 ==';
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='s_allno' ORDER BY ORDINAL_POSITION;
SELECT * FROM dbo.s_allno;
