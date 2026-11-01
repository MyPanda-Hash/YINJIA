SET NOCOUNT ON;
PRINT '--- yj_doc_batch cols ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_doc_batch') ORDER BY c.column_id;
PRINT '--- form_flow_link cols ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.form_flow_link') ORDER BY c.column_id;
PRINT '--- qr_batch_registry cols ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.qr_batch_registry') ORDER BY c.column_id;
PRINT '--- row counts ---';
SELECT 'yj_doc_batch' AS t, COUNT(*) n FROM yj_doc_batch
UNION ALL SELECT 'form_flow_link', COUNT(*) FROM form_flow_link
UNION ALL SELECT 'qr_batch_registry', COUNT(*) FROM qr_batch_registry;
PRINT '--- ms_description of these tables ---';
SELECT OBJECT_NAME(major_id) AS tbl, CAST(value AS nvarchar(400)) AS d
FROM sys.extended_properties WHERE minor_id=0 AND name='MS_Description'
 AND OBJECT_NAME(major_id) IN ('yj_doc_batch','form_flow_link','qr_batch_registry');
