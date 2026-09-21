/* _dryrun-checks.template.sql — 演练用核对查询(UTF-8,中文列名只能在 .sql 里)
   @@DB@@ 由 _dryrun-restore.ps1 替换成临时库名;输出是"键 = 值"两列,脚本按 ASCII 打印。 */
SET NOCOUNT ON;
SELECT N'RD_CHANGE_PANEL' AS k, CAST(COUNT(*) AS nvarchar(10)) AS v FROM [@@DB@@].dbo.yj_panel WHERE panel_code = N'RD_CHANGE'
UNION ALL SELECT N'PANELS',      CAST(COUNT(*) AS nvarchar(10)) FROM [@@DB@@].dbo.yj_panel
UNION ALL SELECT N'TABLES',      CAST(COUNT(*) AS nvarchar(10)) FROM [@@DB@@].sys.tables
UNION ALL SELECT N'DEMO_PROD',   CAST(COUNT(*) AS nvarchar(10)) FROM [@@DB@@].dbo.rd_prod_info_head WHERE 产品编号 LIKE N'DEMO-%'
UNION ALL SELECT N'DEMO_FILES',  CAST(COUNT(*) AS nvarchar(10)) FROM (
  SELECT 单据编号 FROM [@@DB@@].dbo.rd_mold_proc_head WHERE 产品编号 LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM [@@DB@@].dbo.rd_asm_proc_head  WHERE 产品编号 LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM [@@DB@@].dbo.rd_spec_doc_head  WHERE 编号     LIKE N'DEMO-%'
  UNION ALL SELECT 单据编号 FROM [@@DB@@].dbo.rd_insp_plan_head WHERE 产品编号 LIKE N'DEMO-%') t
UNION ALL SELECT N'DEMO_CHANGE', CAST(COUNT(*) AS nvarchar(10)) FROM [@@DB@@].dbo.rd_change_head WHERE 产品编号 LIKE N'DEMO-%'
UNION ALL SELECT N'DEMO_CHG_ROWS', CAST(COUNT(*) AS nvarchar(10)) FROM [@@DB@@].dbo.rd_change_detail WHERE 单据编号 = N'DEMO-CHG-001'
UNION ALL SELECT N'DEMO_TASKS',  CAST(COUNT(*) AS nvarchar(10)) FROM [@@DB@@].dbo.rd_dev_task WHERE 产品编号 LIKE N'DEMO-%'
UNION ALL SELECT N'DEMO_USERS',  CAST(COUNT(*) AS nvarchar(10)) FROM [@@DB@@].dbo.yj_user WHERE username LIKE N'demo[_]%';
