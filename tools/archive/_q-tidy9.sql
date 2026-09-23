SET NOCOUNT ON;
SELECT t.name AS 表, STUFF((SELECT N',' + c.name FROM sys.columns c WHERE c.object_id = t.object_id ORDER BY c.column_id FOR XML PATH('')), 1, 1, N'') AS 列
FROM sys.tables t WHERE t.name IN ('yj_doc_status','rd_mold_proc_detail','rd_asm_proc_detail','rd_insp_plan_detail','rd_change_detail','rd_prod_info_head');
GO
