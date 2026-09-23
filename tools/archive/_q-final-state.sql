SET NOCOUNT ON;
SELECT N'产品信息表' AS 表, CAST(COUNT(*) AS nvarchar(10)) AS 行数, CAST(SUM(CASE WHEN 产品编号 LIKE N'DEMO-%' THEN 1 ELSE 0 END) AS nvarchar(10)) AS 其中演示 FROM rd_prod_info_head
UNION ALL SELECT N'成型工艺清单', CAST(COUNT(*) AS nvarchar(10)), CAST(SUM(CASE WHEN 产品编号 LIKE N'DEMO-%' THEN 1 ELSE 0 END) AS nvarchar(10)) FROM rd_mold_proc_head
UNION ALL SELECT N'组装工艺清单', CAST(COUNT(*) AS nvarchar(10)), CAST(SUM(CASE WHEN 产品编号 LIKE N'DEMO-%' THEN 1 ELSE 0 END) AS nvarchar(10)) FROM rd_asm_proc_head
UNION ALL SELECT N'规格书', CAST(COUNT(*) AS nvarchar(10)), CAST(SUM(CASE WHEN 编号 LIKE N'DEMO-%' THEN 1 ELSE 0 END) AS nvarchar(10)) FROM rd_spec_doc_head
UNION ALL SELECT N'出货检验计划表', CAST(COUNT(*) AS nvarchar(10)), CAST(SUM(CASE WHEN 产品编号 LIKE N'DEMO-%' THEN 1 ELSE 0 END) AS nvarchar(10)) FROM rd_insp_plan_head
UNION ALL SELECT N'产品变更申请单', CAST(COUNT(*) AS nvarchar(10)), CAST(SUM(CASE WHEN 产品编号 LIKE N'DEMO-%' THEN 1 ELSE 0 END) AS nvarchar(10)) FROM rd_change_head
UNION ALL SELECT N'责任人分工行', CAST(COUNT(*) AS nvarchar(10)), CAST(SUM(CASE WHEN 产品编号 LIKE N'DEMO-%' THEN 1 ELSE 0 END) AS nvarchar(10)) FROM rd_dev_task
UNION ALL SELECT N'演示账号(demo_)', CAST(COUNT(*) AS nvarchar(10)), N'-' FROM yj_user WHERE username LIKE N'demo[_]%'
UNION ALL SELECT N'探针账号残留', CAST(COUNT(*) AS nvarchar(10)), N'-' FROM yj_user WHERE username LIKE N'probe[_]%';
GO
