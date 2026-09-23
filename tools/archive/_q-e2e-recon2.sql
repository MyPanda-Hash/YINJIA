SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('rd_prod_info_head') ORDER BY column_id;
GO
SELECT COUNT(*) AS prod_info_rows FROM rd_prod_info_head;
GO
SELECT label, data_type, place, required, hidden FROM yj_field
 WHERE panel_code = 'RD_PROD_INFO' AND place LIKE '%header%' ORDER BY seq;
GO
SELECT N'RD_MOLD_PROC' AS panel, COUNT(*) AS n FROM rd_mold_proc_head
UNION ALL SELECT N'RD_ASM_PROC', COUNT(*) FROM rd_asm_proc_head
UNION ALL SELECT N'RD_SPEC_DOC', COUNT(*) FROM rd_spec_doc_head
UNION ALL SELECT N'RD_INSP_PLAN', COUNT(*) FROM rd_insp_plan_head
UNION ALL SELECT N'rd_dev_task', COUNT(*) FROM rd_dev_task;
GO
