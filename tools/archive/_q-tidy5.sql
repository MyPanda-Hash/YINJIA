SET NOCOUNT ON;
SELECT t.name AS 表, CASE WHEN EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'产品名称') THEN N'有' ELSE N'**缺**' END AS 产品名称,
       CASE WHEN EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id=t.object_id AND c.name=N'产品编号') THEN N'有' ELSE N'**缺**' END AS 产品编号
FROM sys.tables t WHERE t.name IN ('rd_prod_info_head','rd_mold_proc_head','rd_asm_proc_head','rd_spec_doc_head','rd_insp_plan_head','rd_change_head','rd_dev_task','rd_prod_info_detail','rd_asm_proc_detail','rd_insp_plan_detail');
GO
