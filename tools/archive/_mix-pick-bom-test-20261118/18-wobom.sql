SET NOCOUNT ON;
SELECT DB_NAME() AS 库,
       CASE WHEN OBJECT_ID(N'dbo.wo_bom') IS NULL THEN N'缺' ELSE N'在' END AS wo_bom,
       CASE WHEN OBJECT_ID(N'dbo.wo_pick_doc') IS NULL THEN N'缺' ELSE N'在' END AS wo_pick_doc,
       CASE WHEN OBJECT_ID(N'dbo.wo_draft_head') IS NULL THEN N'缺' ELSE N'在' END AS wo_draft_head;
GO
SELECT TOP 5 script_name, executed_at FROM yj_schema_log WHERE script_name LIKE N'%wo-bom%' OR script_name LIKE N'%wo-draft%' ORDER BY executed_at DESC;
