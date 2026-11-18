SET NOCOUNT ON;
SELECT p.panel_code + N'|' + p.panel_name + N'|' + p.module_group + N'|' + ISNULL(p.panel_name_en,N'')
  FROM yj_panel p WHERE p.mode = N'doc' ORDER BY p.panel_code;