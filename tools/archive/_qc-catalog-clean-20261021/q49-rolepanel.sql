SET NOCOUNT ON;
SELECT t.name, STUFF((SELECT ', '+c.name FROM sys.columns c WHERE c.object_id=t.object_id ORDER BY c.column_id FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,2,'') cols FROM sys.tables t WHERE t.name='yj_role_panel';
GO
SELECT * FROM yj_role_panel WHERE panel_code='QC_INSP' AND role_id IN (1,1025,1039);
