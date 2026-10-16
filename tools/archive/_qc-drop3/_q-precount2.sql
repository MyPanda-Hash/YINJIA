SET NOCOUNT ON;
DECLARE @c TABLE(c varchar(40)); INSERT INTO @c VALUES ('QC_MOLD_INSP'),('QC_CUT_INSP'),('QC_FIN_SPEC');
SELECT N'yj_panel' AS t, COUNT(*) AS n FROM yj_panel WHERE panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'yj_field', COUNT(*) FROM yj_field WHERE panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'yj_role_panel', COUNT(*) FROM yj_role_panel WHERE panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'yj_doc_status', COUNT(*) FROM yj_doc_status WHERE panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'form_flow_link', COUNT(*) FROM form_flow_link WHERE source_panel_code IN (SELECT c FROM @c) OR target_panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'yj_form_approval', COUNT(*) FROM yj_form_approval WHERE panel_code IN (SELECT c FROM @c)
UNION ALL SELECT N'yj_translation(panel名)', COUNT(*) FROM yj_translation WHERE scope='panel' AND ref_key IN (SELECT panel_name FROM yj_panel WHERE panel_code IN (SELECT c FROM @c))
UNION ALL SELECT N'yj_translation(字段标签)', COUNT(*) FROM yj_translation WHERE scope='field' AND ref_key IN (SELECT DISTINCT label FROM yj_field WHERE panel_code IN (SELECT c FROM @c))
UNION ALL SELECT N'TOTAL_yj_panel', COUNT(*) FROM yj_panel
UNION ALL SELECT N'TOTAL_yj_field', COUNT(*) FROM yj_field;
GO
