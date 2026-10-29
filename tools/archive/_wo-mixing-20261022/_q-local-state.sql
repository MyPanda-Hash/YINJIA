SET NOCOUNT ON;
SELECT N'[本地] yj_panel' AS k, CAST(COUNT(*) AS nvarchar(10)) AS v FROM dbo.yj_panel
UNION ALL SELECT N'[本地] 最新迁移', ISNULL((SELECT TOP 1 script_name FROM dbo.yj_schema_log ORDER BY applied_at DESC),'(无)')
UNION ALL SELECT N'[本地] 有 wo_mixing_list', CAST(COUNT(*) AS nvarchar(10)) FROM sys.objects WHERE name='wo_mixing_list';
