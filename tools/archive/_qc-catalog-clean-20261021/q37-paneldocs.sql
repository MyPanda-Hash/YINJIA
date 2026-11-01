SET NOCOUNT ON;
SELECT t.name FROM sys.tables t
WHERE EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name='panel_code')
  AND EXISTS(SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name IN ('doc_no','form_no'));
