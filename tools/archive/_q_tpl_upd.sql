SET NOCOUNT ON;
SELECT id, template_code, name, enabled,
       CASE WHEN update_at IS NULL THEN N'NULL!' ELSE CONVERT(nvarchar(23), update_at, 121) END AS upd,
       LEN(jrxml_text) AS xml_chars
FROM dbo.yj_report_template ORDER BY id;
