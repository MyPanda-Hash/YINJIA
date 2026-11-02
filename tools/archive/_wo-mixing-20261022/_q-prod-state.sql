SET NOCOUNT ON;
SELECT N'table' k, CAST(COUNT(*) AS nvarchar(10)) v FROM sys.tables WHERE name='wo_mixing_list'
UNION ALL SELECT N'panel', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.yj_panel WHERE panel_code='WO_MIXING_LIST'
UNION ALL SELECT N'fields', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.yj_field WHERE panel_code='WO_MIXING_LIST'
UNION ALL SELECT N'roles', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.yj_role_panel WHERE panel_code='WO_MIXING_LIST'
UNION ALL SELECT N'rows', CAST(COUNT(*) AS nvarchar(10)) FROM dbo.wo_mixing_list;
