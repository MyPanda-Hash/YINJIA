SET NOCOUNT ON;
SELECT N'PI', CAST(COUNT(*) AS nvarchar(10)) FROM rd_prod_info_head h JOIN yj_doc_status s ON s.panel_code=N'RD_PROD_INFO' AND s.doc_no=h.单据编号
 WHERE h.产品编号 = N'DEMO-B-001' AND s.archived='Y'
UNION ALL SELECT N'FILES', CAST(COUNT(*) AS nvarchar(10)) FROM yj_doc_status s WHERE s.archived='Y' AND s.doc_no IN (
   SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号=N'DEMO-B-001'
   UNION ALL SELECT 单据编号 FROM rd_asm_proc_head WHERE 产品编号=N'DEMO-B-001'
   UNION ALL SELECT 单据编号 FROM rd_spec_doc_head WHERE 编号=N'DEMO-B-001'
   UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号=N'DEMO-B-001')
UNION ALL SELECT N'TASK', CAST(COUNT(*) AS nvarchar(10)) FROM rd_dev_task WHERE 产品编号 = N'DEMO-B-001' AND ISNULL(负责人,N'')<>N'';