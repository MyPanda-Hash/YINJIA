SET NOCOUNT ON;
SELECT N'产品信息表' AS 项, CAST(COUNT(*) AS nvarchar(10)) FROM rd_prod_info_head WHERE 产品编号 LIKE N'DEMO-%'
UNION ALL SELECT N'四文件', CAST(COUNT(*) AS nvarchar(10)) FROM (
  SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM rd_asm_proc_head WHERE 产品编号 LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM rd_spec_doc_head WHERE 编号 LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'DEMO-%') t
UNION ALL SELECT N'责任人分工', CAST(COUNT(*) AS nvarchar(10)) FROM rd_dev_task WHERE 产品编号 LIKE N'DEMO-%'
UNION ALL SELECT N'变更单', CAST(COUNT(*) AS nvarchar(10)) FROM rd_change_head WHERE 产品编号 LIKE N'DEMO-%'
UNION ALL SELECT N'变更单部门行', CAST(COUNT(*) AS nvarchar(10)) FROM rd_change_detail WHERE 单据编号 = N'DEMO-CHG-001'
UNION ALL SELECT N'演示账号', CAST(COUNT(*) AS nvarchar(10)) FROM yj_user WHERE username LIKE N'demo[_]%'
UNION ALL SELECT N'探针残留单', CAST(COUNT(*) AS nvarchar(10)) FROM rd_mold_proc_head WHERE 单据编号 LIKE N'%PROBE%' OR ISNULL(产品编号,N'') LIKE N'%PROBE%'
UNION ALL SELECT N'全库规格书', CAST(COUNT(*) AS nvarchar(10)) FROM rd_spec_doc_head;
GO
