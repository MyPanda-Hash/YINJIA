SET NOCOUNT ON;
SELECT 'yj_attachment: ' + (SELECT c.name + ',' FROM sys.columns c WHERE c.object_id = OBJECT_ID('yj_attachment') FOR XML PATH(''));
SELECT 'yj_form_approval: ' + (SELECT c.name + ',' FROM sys.columns c WHERE c.object_id = OBJECT_ID('yj_form_approval') FOR XML PATH(''));
SELECT 'yj_role_panel: ' + (SELECT c.name + ',' FROM sys.columns c WHERE c.object_id = OBJECT_ID('yj_role_panel') FOR XML PATH(''));
SELECT 'yj_doc_batch: ' + (SELECT c.name + ',' FROM sys.columns c WHERE c.object_id = OBJECT_ID('yj_doc_batch') FOR XML PATH(''));
SELECT 'yj_panel: ' + (SELECT c.name + ',' FROM sys.columns c WHERE c.object_id = OBJECT_ID('yj_panel') FOR XML PATH(''));
SELECT 'yj_field: ' + (SELECT c.name + ',' FROM sys.columns c WHERE c.object_id = OBJECT_ID('yj_field') FOR XML PATH(''));
SELECT 'yj_doc_status: ' + (SELECT c.name + ',' FROM sys.columns c WHERE c.object_id = OBJECT_ID('yj_doc_status') FOR XML PATH(''));
GO
