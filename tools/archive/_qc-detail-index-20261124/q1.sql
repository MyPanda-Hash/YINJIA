SET NOCOUNT ON;
SELECT id, code, name, prefix, doc_type, kind FROM yj_panel WHERE name LIKE N'%检验%' OR code LIKE 'QC_%' ORDER BY code;
