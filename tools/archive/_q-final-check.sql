SET NOCOUNT ON;
SELECT N'测试产品' AS k, CAST(COUNT(*) AS nvarchar(10)) AS n FROM rd_prod_info_head WHERE 产品编号 LIKE N'T-PF%'
UNION ALL SELECT N'四文件探针单', CAST(COUNT(*) AS nvarchar(10)) FROM (
  SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PF%'
  UNION ALL SELECT 单据编号 FROM rd_asm_proc_head WHERE 产品编号 LIKE N'T-PF%'
  UNION ALL SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'T-PF%'
  UNION ALL SELECT 单据编号 FROM rd_spec_doc_head WHERE 编号 LIKE N'T-PF%') t
UNION ALL SELECT N'变更单', CAST(COUNT(*) AS nvarchar(10)) FROM rd_change_head WHERE 产品编号 LIKE N'T-PF%'
UNION ALL SELECT N'责任人行', CAST(COUNT(*) AS nvarchar(10)) FROM rd_dev_task WHERE 产品编号 LIKE N'T-PF%'
UNION ALL SELECT N'探针账号', CAST(COUNT(*) AS nvarchar(10)) FROM yj_user WHERE username LIKE N'probe[_]%';
GO
